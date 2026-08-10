from __future__ import annotations

from typing import Any, Mapping, Optional, Sequence, Union

from fastmcp import FastMCP
from fastmcp.exceptions import ToolError
from pydantic import TypeAdapter

from phoenix.server.mcp_analytics_sql.allowlist import load_allowlist
from phoenix.server.mcp_analytics_sql.catalog import (
    EngineInfo,
    ReflectedIndex,
    cached_engine_info,
    reflect_indexes,
    resolve_pg_schema,
)
from phoenix.server.mcp_analytics_sql.ddl import DetailLevel
from phoenix.server.mcp_analytics_sql.errors import AnalyticsSqlError
from phoenix.server.mcp_analytics_sql.execute import (
    BYTE_LIMIT,
    DEFAULT_ROW_LIMIT,
    MAX_RESPONSE_BYTES,
    MAX_ROW_LIMIT,
    ExecuteParams,
    execute_analytics_sql,
)
from phoenix.server.mcp_analytics_sql.output import (
    ExecuteSqlErrorEnvelope,
    ExecuteSqlSuccessEnvelope,
)
from phoenix.server.mcp_analytics_sql.teaching import describe_sql_schema
from phoenix.server.mcp_server import _META_ANNOTATIONS, _META_TAG
from phoenix.server.types import DbSessionFactory

_ANALYTICS_TAG = "phoenix-analytics-sql"


def _preamble(dialect: str, engine: Optional[EngineInfo]) -> str:
    """The properties that hold for every query, stated once.

    They belong to the surface rather than to any one answer -- on a small
    result they would be most of its bytes and could never take another value --
    so a caller reads them here and the answers carry only what varies.

    The engine line changes which functions a caller will attempt: `percentile`
    is not stock SQLite but is available here through a loaded extension, and a
    caller who assumes stock SQLite never tries it.
    """
    lines = [f"-- Phoenix analytics SQL. Write {dialect} SQL against the tables below."]
    lines.append(
        "-- The global allowlisted schema defines queryable tables, even when this response is "
        "filtered. Raw FOREIGN KEY targets outside that allowlist are descriptive; queries "
        "against them are refused."
    )
    lines.append(
        '-- For columns, call describeSqlSchema with selected `tables` and `detail="detailed"`.'
    )
    if engine:
        version = f" {engine.version}" if engine.version else ""
        extensions = engine.extensions
        loaded = f"; sqlean extensions: {', '.join(extensions)}" if extensions else ""
        lines.append(f"-- backend: {engine.name}{version}{loaded}")
    if dialect == "sqlite":
        lines.append(
            "-- Continuous percentiles: use `percentile(x, p)`, where p is 0–100 "
            "(e.g. `percentile(latency_ms, 50)`); `median` and `percentile_cont` are unavailable."
        )
    else:
        lines.append(
            "-- Continuous percentiles: use `percentile_cont(p) WITHIN GROUP (ORDER BY x)`, "
            "where p is 0–1."
        )
    dialect_functions = (
        "JSON json_extract, json_type, json_each; time date, datetime, unixepoch, julianday"
        if dialect == "sqlite"
        else "JSON jsonb_agg, jsonb_each, jsonb_object_keys, jsonb_path_exists, jsonb_set, "
        "jsonb_typeof; time date_trunc, extract"
    )
    lines.append(
        "-- Common allowed functions: count, sum, avg, min, max, round, abs, ceil, floor, sign, "
        "coalesce, nullif; windows row_number, rank, dense_rank, percent_rank, cume_dist, ntile, "
        f"lag, lead, first_value, last_value, nth_value; {dialect_functions}."
    )
    if dialect == "sqlite":
        lines.append(
            "-- SQLite JSON: `->` yields JSON text; use `->>` or `json_extract` for scalar "
            "values. Cast scalar values before MIN, MAX, or ORDER BY if they may hold numeric "
            "strings."
        )
    backstop = "statement_timeout" if dialect == "postgresql" else "sqlite_progress_handler"
    lines.append(
        f"-- read-only. {DEFAULT_ROW_LIMIT} rows by default, {MAX_ROW_LIMIT} max; "
        f"{BYTE_LIMIT} bytes per row; {MAX_RESPONSE_BYTES} per response; {backstop} deadline."
    )
    lines.append("-- Not snapshot-isolated: identical SQL may differ under concurrent ingestion.")
    # Said once rather than on each of the ~25 places these appear. They behave
    # as columns everywhere a column works, so the only thing worth knowing is
    # that they are computed per row and therefore never indexed.
    lines.append(
        "-- latency_ms and graphql_node_id are virtual: computed per row, not stored or "
        "indexed. Predicates on them evaluate their expression and cannot use a direct index. "
        "Where listed, graphql_node_id is the ID shown in the Phoenix UI and REST API."
    )
    # Stated once here rather than paid for as a refusal per caller. A suffix on
    # the right operand of a JSON operator binds to the whole extraction instead
    # of to the operand, so `a #>> b::text[]`, `a -> b[1]` and `a -> b.c -> d` all
    # group differently from the way PostgreSQL reads them. Brackets settle every
    # one of them, and cost the caller nothing when the operand is a bare literal,
    # which is nearly always.
    # Upstream: https://github.com/tobymao/sqlglot/issues/8035
    lines.append(
        "-- JSON operators: parenthesise a cast, subscript, dotted name or arithmetic "
        "operand; plain literals need no brackets."
    )
    # Stated here for the same reason as the JSON rules: the alternative is a
    # refusal, and a refusal costs a round trip to learn a rule that fits on one
    # line. A naive time of day means "ask the environment", and the write path,
    # the PostgreSQL session zone and SQLite text comparison answer differently.
    lines.append(
        "-- Timestamps: time-of-day literals require a UTC offset, e.g. "
        "`start_time >= '2026-07-01T14:30:00Z'`; bare dates are read as UTC."
    )
    if dialect == "postgresql":
        lines.append(
            "-- PostgreSQL `#>`/`#>>`: parenthesise a cast path, e.g. `attributes #>> "
            "('{a,b}'::text[])`; cast an extracted value as `(attributes #>> '{a,b}')::text[]`."
        )
    return "\n".join(lines)


def _render_indexes(indexes: Mapping[str, Sequence[ReflectedIndex]]) -> str:
    """Indexes in the form a query has to match.

    An expression index is used only when the query repeats the indexed
    expression exactly, so the spelling is the whole point -- describing one in
    prose leaves the caller to guess it back. `CREATE INDEX` is both the native
    form and the one the catalog already returns, via `pg_get_indexdef` on
    PostgreSQL and `sqlite_master.sql` on SQLite.
    """
    lines = [
        "-- Indexes this deployment defines. An expression index is used only when",
        "-- the query repeats the expression exactly, so prefer these spellings. A",
        "-- JSON path here is one this deployment populates and queries.",
    ]
    for table in sorted(indexes):
        for index in indexes[table]:
            unique = "UNIQUE " if index.unique else ""
            lines.append(f"CREATE {unique}INDEX {index.name} ON {table} {index.body};")
    return "\n".join(lines)


ExecuteSqlOutput = Union[ExecuteSqlSuccessEnvelope, ExecuteSqlErrorEnvelope]

# FastMCP requires the root schema to be an object even when it has multiple
# valid shapes. Pydantic owns every member schema so validation and MCP
# documentation cannot drift apart.
_EXECUTE_SQL_OUTPUT_SCHEMA: dict[str, Any] = {
    "type": "object",
    "oneOf": TypeAdapter(ExecuteSqlOutput).json_schema()["anyOf"],
    "$defs": TypeAdapter(ExecuteSqlOutput).json_schema().get("$defs", {}),
}


def register_analytics_sql_tools(mcp: FastMCP, *, db: DbSessionFactory) -> None:
    """Register the analytics SQL tools against a database.

    Open to any caller who reaches the MCP mount, deliberately. These tools read
    telemetry, datasets and experiments, and Phoenix already lets any
    authenticated user read all of that: only `users`, `user_api_keys`,
    `oauth2_grants` and `system_api_keys` carry `IsAdmin`, and none of them is
    allowlisted here. A role check would therefore have been stricter for this
    data than the API it sits beside, refusing in SQL what the same caller can
    fetch through GraphQL.

    What bounds the surface is capability rather than identity: read-only
    statements, a row limit, a per-row and per-response byte cap, a statement
    deadline, and a narrow execution queue.

    `db` is required so that "registered but with no database" is not a state
    this module can be in. It was optional to spare two test call sites an
    argument, which pushed the check to call time: every tool re-resolved the
    factory and raised at the caller if it was missing, turning a wiring mistake
    into an error an LLM sees rather than one startup catches.
    """

    # `output_schema=None` suppresses the structured mirror, which for this tool
    # is a verbatim repeat. MCP's CallToolResult carries a required `content`
    # list and an optional `structuredContent`, and sending both is the
    # convention rather than an accident: the text block is what every client
    # can read, and the structured view is for those that understand it. That
    # is worth paying for a result set. It is not worth paying for prose, where
    # the mirror is `{"result": <the same text>}` and adds no structure to read.
    #
    # This saves nothing on the default path. Under MCP code mode `call_tool`
    # hands the calling code a deserialized value and only what that code
    # returns reaches the model, so neither representation is charged for. It
    # matters for a client that surfaces each tool result directly, where the
    # document would otherwise arrive twice.
    @mcp.tool(tags={_META_TAG, _ANALYTICS_TAG}, annotations=_META_ANNOTATIONS, output_schema=None)
    async def describeSqlSchema(
        area: Optional[str] = None,
        tables: Optional[list[str]] = None,
        detail: DetailLevel = "brief",
        search: Optional[str] = None,
    ) -> str:
        """Return the allowlisted analytics SQL schema for telemetry, datasets, and experiments."""
        if detail not in {"brief", "detailed", "full"}:
            raise ToolError("detail must be one of: brief, detailed, full")

        # Text, not a JSON envelope. Nothing parses this -- over MCP it goes
        # straight into a model's context -- so structure no reader uses is
        # charged for and never read. The envelope also charged for itself:
        # JSON escapes every newline in a document that is mostly newlines,
        # which cost 174 tokens at `detailed`, about 7%.
        sections = [
            _preamble(db.dialect.value, await cached_engine_info(db)),
            describe_sql_schema(
                area=area,
                tables=tables,
                detail=detail,
                search=search,
                dialect=db.dialect.value,
            ),
        ]

        # Indexes belong to the running deployment rather than to the schema, so
        # they are read live and only when the caller has asked for enough
        # detail to act on them. At "brief" the caller is still choosing tables
        # and cannot yet write the expression an index would require.
        if detail == "full":
            allowlist = load_allowlist(db.dialect.value)
            # Narrowed by `area` as well as `tables`. Filtering on `tables`
            # alone meant asking for one area still returned every index in the
            # deployment, so a telemetry request came back carrying experiment
            # indexes -- noise about tables the same response never described.
            requested = allowlist.areas.get(area, frozenset()) if area else allowlist.tables
            if tables:
                requested &= frozenset(tables)
            # The schema resolved against the connection, not the manifest's
            # hardcoded default, so this publishes indexes from the same
            # configured schema the executor reads.
            pg_schema = (
                await resolve_pg_schema(db) if db.dialect.value == "postgresql" else "public"
            )
            indexes = await reflect_indexes(db, tables=requested, pg_schema=pg_schema)
            if indexes:
                sections.append(_render_indexes(indexes))
        return "\n\n".join(section for section in sections if section)

    # A dict, so the result arrives as data rather than as something to parse.
    # It is emitted both ways -- serialized into the text block and as
    # structured content -- which is the MCP convention and is what makes the
    # tool usable by clients that read only one of them.
    #
    # Returning text instead would defeat the path this surface is actually
    # driven from. Under code mode `call_tool` returns the deserialized dict to
    # the calling code, which filters and aggregates before returning anything;
    # measured across five orchestrated calls, 11,522 bytes of envelopes were
    # fetched and roughly 200 bytes reached the model. Handing that code a
    # string would put a JSON parse in front of every one of those steps to
    # save bytes that were never spent.
    @mcp.tool(
        tags={_META_TAG, _ANALYTICS_TAG},
        annotations=_META_ANNOTATIONS,
        output_schema=_EXECUTE_SQL_OUTPUT_SCHEMA,
    )
    async def executeSql(
        sql: str,
        validate_only: bool = False,
        row_limit: Optional[int] = None,
    ) -> ExecuteSqlOutput:
        """Execute read-only analytics SQL against allowlisted Phoenix tables.

        Returns either the columns, rows, and applied limits, or an error
        envelope when the SQL cannot be accepted.

        `row_count_is_partial` is the authoritative answer to whether the result
        was truncated by either row or response-byte limits. One row beyond the
        row limit is fetched, and `notes` identifies the limit that applied.
        `estimated_rows` is available only on PostgreSQL, where it is the
        planner's untruncated-row estimate. It is not a count, it can be out by
        a large factor over JSON paths, and it never answers the truncation
        question -- that is what the flag is for.

        `applied` describes the effective dialect, row limit, and rewrites;
        `backend_validated` says whether the backend execution gate ran; `notes`
        lists caveats callers should not infer.

        Code-mode `call_tool` already returns this envelope as a dictionary.
        Check for an `error` key before reading `rows`. Preserve any error in
        your summary; do not call `json.loads` on the result.

        With `validate_only=True`, Phoenix validates the statement but does not
        execute it for data; the successful empty result carries a note saying so.
        """
        try:
            result = await execute_analytics_sql(
                db,
                ExecuteParams(
                    sql=sql,
                    validate_only=validate_only,
                    row_limit=row_limit,
                ),
            )
            return result.envelope
        except AnalyticsSqlError as exc:
            return ExecuteSqlErrorEnvelope.from_error(exc)

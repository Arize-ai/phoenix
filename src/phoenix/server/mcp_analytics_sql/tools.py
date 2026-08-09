from __future__ import annotations

from typing import Any, Optional

from fastmcp import FastMCP
from fastmcp.exceptions import ToolError

from phoenix.server.mcp_analytics_sql.allowlist import load_allowlist
from phoenix.server.mcp_analytics_sql.catalog import (
    cached_engine_info,
    reflect_indexes,
    resolve_pg_schema,
)
from phoenix.server.mcp_analytics_sql.errors import AnalyticsSqlError, ErrorCode
from phoenix.server.mcp_analytics_sql.execute import (
    BYTE_LIMIT,
    DEFAULT_ROW_LIMIT,
    MAX_RESPONSE_BYTES,
    MAX_ROW_LIMIT,
    ExecuteParams,
    execute_analytics_sql,
)
from phoenix.server.mcp_analytics_sql.teaching import DetailLevel, describe_sql_schema
from phoenix.server.mcp_server import _META_ANNOTATIONS, _META_TAG
from phoenix.server.types import DbSessionFactory

_ANALYTICS_TAG = "phoenix-analytics-sql"


def _preamble(dialect: str, engine: Optional[dict[str, Any]]) -> str:
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
    if engine:
        version = f" {engine['version']}" if engine.get("version") else ""
        extensions = engine.get("extensions") or []
        loaded = f"; extensions loaded: {', '.join(extensions)}" if extensions else ""
        lines.append(f"-- backend: {engine.get('name', dialect)}{version}{loaded}")
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
        "-- latency_ms and graphql_node_id are computed per row, not stored: usable "
        "anywhere a column is, but never indexed."
    )
    # Stated once here rather than paid for as a refusal per caller. A suffix on
    # the right operand of a JSON operator binds to the whole extraction instead
    # of to the operand, so `a #>> b::text[]`, `a -> b[1]` and `a -> b.c -> d` all
    # group differently from the way PostgreSQL reads them. Brackets settle every
    # one of them, and cost the caller nothing when the operand is a bare literal,
    # which is nearly always.
    # Upstream: https://github.com/tobymao/sqlglot/issues/8035
    lines.append(
        "-- JSON operators: parenthesise any operand that is not a plain literal. "
        "`attributes ->> 'model'` is fine as written, but a cast, subscript, dotted "
        "name or arithmetic must be bracketed, as in `attributes -> ('a'[1])`, or it "
        "is read as applying to the whole extraction rather than to the operand."
    )
    # Stated here for the same reason as the JSON rules: the alternative is a
    # refusal, and a refusal costs a round trip to learn a rule that fits on one
    # line. A naive time of day means "ask the environment", and the write path,
    # the PostgreSQL session zone and SQLite text comparison answer differently.
    lines.append(
        "-- Timestamps: a literal naming a time of day must carry a UTC offset, as in "
        "`start_time >= '2026-07-01T14:30:00Z'`; without one it is refused, because "
        "this surface will not choose a zone for you. Any ISO spelling is accepted. A "
        "bare date such as `2026-07-01` needs no offset and is read as UTC."
    )
    if dialect == "postgresql":
        lines.append(
            "-- A `#>`/`#>>` path literal needs no cast at all. A bare cast after those "
            "operators is ambiguous and is refused: write `attributes #>> "
            "('{a,b}'::text[])` to cast the path, `(attributes #>> '{a,b}')::text[]` to "
            "cast the extracted value."
        )
    return "\n".join(lines)


def _render_indexes(indexes: dict[str, list[dict[str, Any]]]) -> str:
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
            unique = "UNIQUE " if index.get("unique") else ""
            lines.append(f"CREATE {unique}INDEX {index['name']} ON {table} {index['on']};")
    return "\n".join(lines)


# The result's shapes, stated where a consumer can read them per field.
#
# FastMCP derives an output schema from the return annotation when none is
# given, and `dict[str, Any]` yields `{"type": "object"}` -- true, and empty. It
# names no field, so the distinctions that decide how an answer is read had
# nowhere to live except prose in the tool description.
#
# `additionalProperties` is deliberately left open. Declaring it closed would
# turn a field added here without updating this schema into a runtime failure
# for every caller, which is a poor trade for a documentation guarantee; the
# drift is caught in CI instead, by a test comparing a real envelope's keys
# against these properties.
_EXECUTE_SQL_SUCCESS_SCHEMA: dict[str, Any] = {
    "type": "object",
    "required": [
        "columns",
        "rows",
        "row_count",
        "row_count_is_partial",
        "applied",
        "backend_validated",
        "notes",
    ],
    "properties": {
        "columns": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Column names, in the order their values appear in each row.",
        },
        "rows": {
            "type": "array",
            "items": {"type": "array"},
            "description": "One array of values per row, positionally aligned with `columns`.",
        },
        "row_count": {
            "type": "integer",
            "description": "Rows returned, after any truncation to `applied.row_limit`.",
        },
        "row_count_is_partial": {
            "type": "boolean",
            "description": (
                "Whether rows were dropped. Authoritative rather than inferred: one row "
                "beyond the limit is fetched, and this is true only when that row actually "
                "arrived. A result of exactly row_limit rows is otherwise indistinguishable "
                "from one that was cut off."
            ),
        },
        "applied": {
            "type": "object",
            "required": ["row_limit", "dialect", "rewrites"],
            "properties": {
                "row_limit": {
                    "type": "integer",
                    "description": "The limit in force for this call, after clamping.",
                },
                "dialect": {
                    "type": "string",
                    "enum": ["postgresql", "sqlite"],
                    "description": "Which SQL to write. The two differ on JSON, percentiles "
                    "and time bucketing.",
                },
                "rewrites": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": (
                        "Server-side transforms that fired, named rather than described. "
                        "The executed statement is not the one submitted."
                    ),
                },
            },
        },
        "backend_validated": {
            "type": "boolean",
            "description": "Whether the engine's own gate ran: the EXPLAIN plan check on "
            "PostgreSQL, the authorizer callback on SQLite.",
        },
        "notes": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Anything about this answer the caller should not have to infer.",
        },
        "estimated_rows": {
            "type": "integer",
            "description": (
                "The planner's estimate of what the statement would return untruncated, "
                "read below the injected LIMIT. A magnitude for deciding whether to narrow "
                "the query, not a count: PostgreSQL keeps no statistics for expressions over "
                "JSON paths, so it can be out by a large factor. It never answers whether "
                "this result was truncated -- `row_count_is_partial` does. PostgreSQL only."
            ),
        },
    },
}

_EXECUTE_SQL_ERROR_SCHEMA: dict[str, Any] = {
    "type": "object",
    "required": ["error"],
    "properties": {
        "error": {
            "type": "object",
            "required": ["code", "message"],
            "properties": {
                "code": {
                    "type": "string",
                    "enum": [code.value for code in ErrorCode],
                    "description": "Machine-readable reason the SQL statement was refused.",
                },
                "message": {
                    "type": "string",
                    "description": (
                        "Explanation of the refusal and, when available, how to correct it."
                    ),
                },
                "identifiers": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Relations, columns, or functions involved in the refusal.",
                },
            },
        },
    },
}

_EXECUTE_SQL_OUTPUT_SCHEMA: dict[str, Any] = {
    # FastMCP requires the root schema to be an object even when that object
    # has multiple valid shapes.
    "type": "object",
    "oneOf": [_EXECUTE_SQL_SUCCESS_SCHEMA, _EXECUTE_SQL_ERROR_SCHEMA],
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
    ) -> dict[str, Any]:
        """Execute read-only analytics SQL against allowlisted Phoenix tables.

        Returns either the columns, rows, and applied limits, or an error
        envelope when the SQL cannot be accepted.

        `row_count_is_partial` is the authoritative answer to whether the result
        was truncated: one row beyond the limit is fetched, and the flag is set
        only when that row actually arrived. `estimated_rows` is the planner's
        guess at what the statement would return untruncated, useful as a
        magnitude for deciding whether to narrow the query. It is not a count,
        it can be out by a large factor over JSON paths, and it never answers
        the truncation question -- that is what the flag is for.
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
            return exc.to_envelope()

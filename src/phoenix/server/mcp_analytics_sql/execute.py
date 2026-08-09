from __future__ import annotations

import asyncio
import itertools
import json
import logging
import re
import sqlite3
import threading
import time
from collections.abc import Callable
from dataclasses import dataclass, field, replace
from functools import lru_cache
from typing import Any, Optional, cast

import sqlean
from sqlalchemy import text
from sqlalchemy.engine import make_url
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.sql.elements import TextClause

from phoenix.config import get_env_database_connection_str
from phoenix.db.helpers import SupportedSQLDialect
from phoenix.server.mcp_analytics_sql.allowlist import (
    PLAN_GATE_ALLOWED_FUNCTIONS,
    SQLITE_TABLE_VALUED_FUNCTIONS,
    SRF_NODE_TYPES,
    UNNEST_FUNCTIONS,
    Allowlist,
    DialectName,
    load_allowlist,
    sqlite_authorizer_functions,
)
from phoenix.server.mcp_analytics_sql.catalog import (
    cached_indexed_json_accessors,
    resolve_pg_schema,
)
from phoenix.server.mcp_analytics_sql.errors import AnalyticsSqlError, ErrorCode
from phoenix.server.mcp_analytics_sql.normalize import (
    LOSSY_CONVERSION_NOTES,
    normalize_row_values,
)
from phoenix.server.mcp_analytics_sql.parse import admit, parse_sql, render
from phoenix.server.mcp_analytics_sql.rewrite import RewriteContext, rewrite
from phoenix.server.types import DbSessionFactory

logger = logging.getLogger(__name__)

_call_counter = itertools.count(1)


def _next_call_id() -> str:
    """Short tag grouping every line emitted for one execution.

    Concurrent callers interleave in the log, and nothing else distinguishes
    them: the lines carry a timestamp and a module name and no notion of who
    asked. Without a tag, reconstructing what any single caller did means
    guessing from content and ordering, which is exactly the sort of inference
    that quietly goes wrong when two callers run similar statements.
    """
    return f"q{next(_call_counter):04d}"


DEFAULT_ROW_LIMIT = 500

# The tool parameter is caller-controlled, so the default protects nothing on its
# own. Rows accumulate in memory before encoding, and the per-cell byte check
# cannot see a response made large by many small rows rather than one big one.
MAX_ROW_LIMIT = 5_000

# Ceiling on the whole encoded response, as distinct from any single cell.
MAX_RESPONSE_BYTES = 4 * 1024 * 1024
BYTE_LIMIT = 262_144
PG_STATEMENT_TIMEOUT_MS = 30_000
SQLITE_TIMEOUT_SECONDS = 30


@dataclass
class ExecutionSemaphore:
    _width_by_dialect: dict[DialectName, int] = field(
        default_factory=lambda: {"postgresql": 4, "sqlite": 1}
    )
    _queue_size: int = 8
    _locks: dict[DialectName, asyncio.Semaphore] = field(default_factory=dict)
    _waiting: dict[DialectName, int] = field(default_factory=lambda: {"postgresql": 0, "sqlite": 0})
    _guard: asyncio.Lock = field(default_factory=asyncio.Lock)

    async def acquire(self, dialect: DialectName) -> None:
        async with self._guard:
            if self._waiting[dialect] >= self._queue_size:
                # Logged, not merely returned. Saturation is the one failure the
                # caller cannot diagnose and the operator most needs to see: the
                # caller is told to retry, while the reason -- that concurrent
                # demand exceeded a deliberately narrow queue -- exists only
                # here. Without this the condition leaves no server-side trace,
                # so an operator grepping for it finds nothing and reads the
                # absence as health.
                logger.warning(
                    "analytics sql: %s queue is full at %d waiting; request refused",
                    dialect,
                    self._waiting[dialect],
                )
                raise AnalyticsSqlError(
                    code=ErrorCode.QUEUE_FULL,
                    message="Too many analytics SQL requests are queued.",
                )
            self._waiting[dialect] += 1
        lock = self._locks.setdefault(dialect, asyncio.Semaphore(self._width_by_dialect[dialect]))
        try:
            await lock.acquire()
        finally:
            # Decremented in a finally because a client disconnecting while
            # queued cancels the await above. Without it the slot is never
            # returned, and enough cancellations leave the queue permanently
            # full for the life of the process.
            #
            # Deliberately *not* under `_guard`. Taking the lock here means
            # awaiting inside a `finally` that a cancellation is already
            # unwinding, and a second cancellation delivered during that await
            # skips the decrement -- reintroducing the leak this block exists
            # to prevent. Demonstrated: hold the guard, cancel twice, and the
            # count stays at 1 forever. The guard is unnecessary anyway. It
            # exists to make the read-compare-increment above indivisible; a
            # bare decrement contains no await point, so no other coroutine can
            # observe a torn value on a single-threaded loop.
            self._waiting[dialect] -= 1

    def release(self, dialect: DialectName) -> None:
        lock = self._locks.get(dialect)
        if lock is not None:
            lock.release()


EXECUTION_SEMAPHORE = ExecutionSemaphore()


@dataclass(frozen=True)
class ExecuteParams:
    sql: str
    validate_only: bool = False
    row_limit: Optional[int] = None


@dataclass(frozen=True)
class ExecuteResult:
    envelope: dict[str, Any]


_FUNCTION_CALL = re.compile(r"([A-Za-z_][A-Za-z0-9_]*)\s*\(")

# Words that precede an open parenthesis without being a call. The ProjectSet
# branch reads expression *text*, so it cannot tell a function from a keyword:
# `EXTRACT(epoch FROM (end_time - start_time))` -- the inner parenthesis coming
# from our own latency rewrite -- was reported as a disallowed function named
# "from", refusing a statement the schema teaches. A caller-written
# `EXTRACT(EPOCH FROM s.start_time)` passed only because its operand is a bare
# column with no parenthesis after it, so the failure looked data-dependent.
_NOT_A_CALL = frozenset(
    {
        "all",
        "and",
        "any",
        "as",
        "between",
        "by",
        "case",
        "distinct",
        "else",
        "end",
        "exists",
        "filter",
        "from",
        "group",
        "in",
        "is",
        "like",
        "not",
        "on",
        "or",
        "order",
        "over",
        "partition",
        "then",
        "using",
        "values",
        "when",
        "where",
        "within",
    }
)


def _function_identifiers(plan_node: dict[str, Any]) -> list[str]:
    node_type = plan_node.get("Node Type")
    names: list[str] = []
    if node_type == "Function Scan":
        fn = plan_node.get("Function Name")
        if fn:
            names.append(str(fn))
    elif node_type == "ProjectSet":
        # A ProjectSet names its set-returning functions inside its Output
        # expressions rather than in a dedicated field, so they have to be read
        # out of the expression text. Every identifier immediately preceding an
        # open parenthesis is collected, which covers nesting and schema
        # qualification -- pg_catalog.generate_series(...) yields
        # "generate_series", matching how the allowlist names it.
        for output in plan_node.get("Output") or []:
            if isinstance(output, str):
                names.extend(
                    match.group(1).lower()
                    for match in _FUNCTION_CALL.finditer(output)
                    if match.group(1).casefold() not in _NOT_A_CALL
                )
    return names


def _walk_plan(node: dict[str, Any]) -> list[dict[str, Any]]:
    nodes = [node]
    for child in node.get("Plans") or []:
        nodes.extend(_walk_plan(child))
    return nodes


def _plan_verification_failed(
    message: str, *, identifiers: tuple[str, ...] = ()
) -> AnalyticsSqlError:
    """Refuse a plan, and say so loudly.

    Reaching here means admission accepted a statement that the engine then
    resolved to something else. Admission is supposed to be the thing that
    prevents this, so a failure is evidence that the two disagree rather than
    ordinary caller error -- it is logged at warning so it is visible without
    debug logging enabled, and it should be investigated rather than dismissed.
    """
    logger.warning("analytics sql: plan verification failed - %s", message)
    return AnalyticsSqlError(
        code=ErrorCode.PLAN_VERIFICATION_FAILED,
        message=message,
        identifiers=identifiers,
    )


def verify_postgres_plan(
    plan_json: list[dict[str, Any]], *, allowlist: Allowlist, schema: str
) -> None:
    root = plan_json[0]["Plan"]
    for node in _walk_plan(root):
        rel = node.get("Relation Name")
        if rel is not None:
            if rel not in allowlist.tables or node.get("Schema") != schema:
                raise _plan_verification_failed(
                    f"Plan references disallowed relation {rel!r}.", identifiers=(rel,)
                )
        if node.get("Node Type") in SRF_NODE_TYPES:
            fns = _function_identifiers(node)
            if not fns:
                raise _plan_verification_failed(
                    "Plan contains an unverified set-returning function."
                )
            # Output expressions mix the set-returning function with ordinary
            # scalars, so each name is checked against everything admission
            # permits rather than against the unnest family alone -- otherwise a
            # valid `coalesce` beside a valid `jsonb_each` would be refused.
            for fn in fns:
                if fn not in PLAN_GATE_ALLOWED_FUNCTIONS:
                    raise _plan_verification_failed(
                        f"Plan references disallowed function {fn!r}.", identifiers=(fn,)
                    )
            if not any(fn in UNNEST_FUNCTIONS for fn in fns):
                raise _plan_verification_failed(
                    "Plan contains a set-returning node naming no permitted unnest function."
                )


@dataclass
class _Denial:
    """What the authorizer refused, so the caller can be told rather than guessed at.

    SQLite reports a refusal to the driver as a generic operational error, and
    sanitizing that string leaves ``Query execution failed`` -- true, useless, and
    indistinguishable from a dozen other causes. The authorizer is the only place
    that knows which identifier was rejected, so it records it here.

    Disclosing the identifier is safe: it is either a name the caller wrote or a
    name our own rendering produced from what they wrote, so it tells them nothing
    they did not already supply.
    """

    code: ErrorCode
    identifier: str
    message: str


@lru_cache
def _phoenix_table_names() -> frozenset[str]:
    """Every table Phoenix defines, allowlisted or not.

    Used only to classify a denial, never to decide one. A name in this set that
    reached the engine is a table admission was supposed to refuse; a name
    outside it belongs to no table at all and is therefore something the
    statement or its rewrites brought into being.
    """
    from phoenix.db import models

    return frozenset(models.Base.metadata.tables)


def _sqlite_authorizer(
    allow_tables: frozenset[str],
    allowed_functions: frozenset[str],
    denials: Optional[list[_Denial]] = None,
    introduced_relations: frozenset[str] = frozenset(),
) -> Callable[[int, Optional[str], Optional[str], Optional[str], Optional[str]], int]:
    def authorizer(
        action: int,
        arg1: Optional[str],
        arg2: Optional[str],
        dbname: Optional[str],
        via: Optional[str],
    ) -> int:
        # `via` is SQLite's fifth authorizer argument: the innermost view or
        # trigger on whose behalf the access happens, and the only provenance
        # this callback gets. It was discarded, so a read of `spans` and a read
        # of something merely *named* `spans` were the same event.
        #
        # Measured, because the values are not obvious:
        #
        #   SELECT secret FROM spans          ('spans','secret','main',None)
        #   SELECT count(*) FROM spans        ('spans','',      None,  None)
        #   WITH t AS (...) SELECT id FROM t  ('spans','id',    'main','t')
        #   SELECT name FROM v_spans          ('spans','id',    'main','v_spans')
        #                                     ('v_spans','name','temp',None)
        #
        # So a direct base-table read is distinguishable from one reached
        # through a relation, and the relation names itself.

        # Every denial here is a disagreement between admission and the engine,
        # because admission has already checked the caller's tables against the
        # same allowlist. Two very different things produce that disagreement,
        # and a log that spells them alike cannot show whether the check has ever
        # refused a forbidden table or has only ever tripped over relations this
        # statement introduced.
        #
        # `bypass` means the engine resolved a name that belongs to Phoenix's
        # schema and is not allowlisted. Admission should have refused it and did
        # not, so this is the case the authorizer exists for and the only one
        # that is evidence of anything reaching further than intended.
        #
        # `unresolved` means a name belonging to no table at all -- a relation
        # this statement created, or one the rewrites created on its behalf.
        # Denying it refuses a legitimate query, so it is a defect in the layers
        # rather than a defence of them.
        def deny(code: ErrorCode, identifier: str, message: str, *, kind: str = "policy") -> int:
            if kind == "bypass":
                logger.error("analytics sql: authorizer caught an admission bypass - %s", message)
            elif kind == "unresolved":
                logger.error(
                    "analytics sql: authorizer denied %r, which is not a table in this schema "
                    "and was not declared by the statement. This refuses a query the caller "
                    "was entitled to run; treat it as a layering defect, not a policy hit.",
                    identifier,
                )
            else:
                logger.warning("analytics sql: authorizer denied %s", message)
            if denials is not None:
                denials.append(_Denial(code=code, identifier=identifier, message=message))
            return sqlite3.SQLITE_DENY

        if action == sqlite3.SQLITE_READ:
            table = arg1 or ""
            # Reached through a relation the statement never declared, which
            # means a view or trigger standing in the database. Admission
            # approved a set of tables; it approved no indirection, and this
            # callback cannot see what the object selects -- so a view named
            # after an allowlisted table reads as that table and passes.
            #
            # Denied rather than resolved, because resolving it needs the view's
            # definition and there is nothing here to read it with. If curated
            # views are ever introduced, this is where their names belong: the
            # rule becomes "this view and no other" rather than "no view".
            if via is not None and via not in introduced_relations:
                return deny(
                    ErrorCode.RELATION_NOT_ALLOWED,
                    via,
                    f"read reached through {via!r}, which this statement did not declare",
                    kind="bypass",
                )
            # Order matters here, and it did not used to. A table-level read --
            # what `count(*)` emits, since it names no column -- presents with
            # no database attached, exactly like a transient table. So the
            # transient accept below cannot come first: placed there it returned
            # OK before the catalog deny and before the allowlist check, which
            # made `SELECT (SELECT count(*) FROM users)` and the same over
            # sqlite_master pass this gate. Admission refuses both, so nothing
            # leaked, but the backstop this function exists to be was absent for
            # every count-shaped read.
            if table == "sqlite_master":
                return deny(
                    ErrorCode.RELATION_NOT_ALLOWED,
                    "sqlite_master",
                    "reading the database catalog is not permitted; "
                    "use describeSqlSchema to discover tables and columns",
                )
            # A real table that is not allowlisted is refused however the read
            # presents, with or without a database name, and ahead of every
            # accept below.
            #
            # An earlier revision put the declared-relation accept first, gated
            # on `dbname is None`, to stop a caller's CTE being reported as an
            # admission bypass. Both halves of that were wrong. A caller CTE
            # shadowing a table emits no *read* event -- SQLite resolves the
            # name before any read is authorized, and the only event it does
            # deliver is a SELECT naming the CTE -- so the accept was not what
            # let those statements run. And a table-level read,
            # which `count(*)` emits, presents as `(table, '', None, None)`:
            # `dbname is None` is true for the *physical* table, so the gate
            # accepted `count(*)` over a forbidden table whenever a caller
            # aliased any subquery to its name. `introduced_relations` is a flat
            # set of caller-chosen strings, which is not a basis for skipping
            # the one check that exists to catch an admission bypass.
            if table in _phoenix_table_names() and table not in allow_tables:
                return deny(
                    ErrorCode.RELATION_NOT_ALLOWED,
                    table,
                    f"table {table!r} is not available for analytics SQL; "
                    "describeSqlSchema lists the tables that are",
                    kind="bypass",
                )
            # A relation this statement declared. Kept because a read reported
            # against such a name must not be refused for being unknown to the
            # manifest; no probed shape produces one, since a read through a
            # CTE or subquery names the base table instead, so treat this as a
            # backstop for shapes not enumerated rather than a described case.
            # Reached only for statement-local names, not persisted Phoenix
            # tables, so accepting here cannot bypass table admission.
            if table in introduced_relations:
                return sqlite3.SQLITE_OK
            # A table-valued function is reported as a read of a pseudo-table
            # named after the function. Its rows come from the JSON value passed
            # in, not from storage, so the table allowlist has nothing to say
            # about it; whether the function is permitted was already decided.
            if table in SQLITE_TABLE_VALUED_FUNCTIONS:
                return sqlite3.SQLITE_OK
            # Anything else with no database attached is a result the engine
            # built for itself, reachable only from rows this statement already
            # read and this function already approved.
            if dbname is None:
                return sqlite3.SQLITE_OK
            if table and table not in allow_tables:
                return deny(
                    ErrorCode.RELATION_NOT_ALLOWED,
                    table,
                    f"table {table!r} is not available for analytics SQL; "
                    "describeSqlSchema lists the tables that are",
                    kind="unresolved",
                )
        if action == sqlite3.SQLITE_FUNCTION:
            func = (arg2 or arg1 or "").lower()
            if func and func not in allowed_functions:
                return deny(
                    ErrorCode.FUNCTION_NOT_ALLOWED,
                    func,
                    f"function {func!r} is not in the allowlist for this backend",
                )
        return sqlite3.SQLITE_OK

    return authorizer


def resolve_sqlite_db_path() -> Optional[str]:
    """Filesystem path of the configured SQLite database, or None if it has none.

    Analytics reads open their own read-only connection rather than borrowing the
    application's, so they need a path rather than an engine. Returns None for an
    in-memory database, which cannot be opened a second time read-only and is the
    one SQLite configuration this surface declines.

    Callers must not skip this and pass None themselves: the caller cannot
    distinguish "no path exists" from "nobody looked", and those produce the same
    refusal with very different causes.
    """
    url = make_url(get_env_database_connection_str())
    if not url.drivername.startswith("sqlite"):
        return None
    database = url.database
    if not database or database.startswith(":memory:"):
        logger.debug(
            "analytics sql: no file-backed sqlite database (url=%s)",
            url.render_as_string(),
        )
        return None
    logger.debug("analytics sql: resolved sqlite database path %s", database)
    return database


async def execute_analytics_sql(
    db: DbSessionFactory,
    params: ExecuteParams,
    *,
    sqlite_db_path: Optional[str] = None,
) -> ExecuteResult:
    dialect: DialectName = (
        "postgresql" if db.dialect is SupportedSQLDialect.POSTGRESQL else "sqlite"
    )
    if dialect == "sqlite" and sqlite_db_path is None:
        sqlite_db_path = resolve_sqlite_db_path()
    if dialect == "sqlite" and not sqlite_db_path:
        raise AnalyticsSqlError(
            code=ErrorCode.BACKEND_UNAVAILABLE,
            message=(
                "Analytics SQL requires a file-backed SQLite database; "
                "this deployment uses an in-memory one."
            ),
        )

    allowlist = load_allowlist(dialect)
    if dialect == "postgresql":
        # Resolved against the connection, not assumed. With the schema variable
        # unset and the tables reached through `search_path`, a hardcoded
        # "public" names a schema that does not hold them, and every rewritten
        # relation is then qualified wrong.
        schema = await resolve_pg_schema(db)
        allowlist = replace(allowlist, pg_schema=schema)

    call_id = _next_call_id()
    await EXECUTION_SEMAPHORE.acquire(dialect)
    try:
        try:
            root = parse_sql(params.sql, dialect=dialect)
            root = admit(root, allowlist=allowlist, dialect=dialect)
        except AnalyticsSqlError as exc:
            # A refusal is ordinary traffic, not an incident -- callers are
            # expected to probe the boundary. Debug level records which rule
            # fired, because the caller-facing message deliberately says less
            # than the reason does.
            logger.debug(
                "analytics sql: %s refused at admission (%s) %s | sql=%s",
                call_id,
                exc.code.value,
                exc.message,
                " ".join(params.sql.split()),
            )
            raise

        # No window unless the caller asks for one, because a window narrows the
        # question rather than bounding the work: it answers something other than
        # what was asked and reports success. The guards that do bound the work
        # are the row limit, the byte caps and the statement deadline, none of
        # which change the answer -- a deadline stops a runaway scan with an
        # error the caller can act on.
        requested = params.row_limit if params.row_limit is not None else DEFAULT_ROW_LIMIT
        row_limit = max(1, min(requested, MAX_ROW_LIMIT))
        ctx = RewriteContext(
            allowlist=allowlist,
            dialect=dialect,
            row_limit=row_limit,
            indexed_json_accessors=await cached_indexed_json_accessors(
                db, tables=allowlist.tables, pg_schema=allowlist.pg_schema
            ),
        )
        root = rewrite(root, ctx)
        rendered = render(root, dialect=dialect)

        # The executed statement is not the one the caller wrote: stars are
        # expanded, virtual columns substituted, timestamp literals re-emitted
        # and relations schema-qualified, a row limit applied. Debug level
        # because the statement can carry literal values from the caller's
        # predicates.
        logger.debug(
            "analytics sql: %s dialect=%s rewrites=%s limit=%d",
            call_id,
            dialect,
            ",".join(ctx.applied) or "none",
            row_limit,
        )
        # Collapsed to one line: callers submit multi-line SQL, and a log entry
        # that spans lines cannot be grepped -- the search matches the first line,
        # which is usually blank.
        logger.debug("analytics sql: %s caller   %s", call_id, " ".join(params.sql.split()))
        logger.debug("analytics sql: %s executed %s", call_id, rendered)
        ctx.caller_sql = params.sql
        ctx.executed_sql = rendered

        started = time.monotonic()
        if dialect == "postgresql":
            result = await _execute_postgres(
                db,
                rendered,
                allowlist=allowlist,
                validate_only=params.validate_only,
                ctx=ctx,
            )
        else:
            result = await _execute_sqlite_file(
                sqlite_db_path or "",
                rendered,
                allowlist=allowlist,
                validate_only=params.validate_only,
                ctx=ctx,
            )
        logger.debug(
            "analytics sql: %s completed in %.1fms rows=%s partial=%s",
            call_id,
            (time.monotonic() - started) * 1000,
            result.envelope.get("row_count"),
            result.envelope.get("row_count_is_partial"),
        )
        return result
    finally:
        EXECUTION_SEMAPHORE.release(dialect)


# SQLAlchemy's asyncpg dialect uses the `numeric_dollar` paramstyle, and its
# compiler rewrites internal `%(name)s` markers to `$N` by running a regex over
# the *final* SQL string -- its own comment reads "Can't use format here since %
# chars are not escaped". A literal `%(word)s` in caller SQL is therefore
# indistinguishable from a placeholder and raises KeyError inside the compiler.
# There is no escape that survives, because the substitution happens after
# escaping is resolved.
# Deliberately the same shape as SQLAlchemy's own `_pyformat_pattern`,
# `%\(([^)]+?)\)s`. A narrower `\w+` left `%(a-b)s`, `%(a b)s` and
# `%(a.b)s` to reach the compiler and raise the same unhandled KeyError
# this guard exists to prevent -- and hyphens, spaces and dots are
# ordinary inside a LIKE pattern.
_PYFORMAT_MARKER = re.compile(r"%\([^)]+?\)s")


def _as_text(rendered_sql: str) -> TextClause:
    """Wrap rendered SQL for execution without letting it be reparsed for binds.

    The statement is already complete, so every `:` in it belongs to a literal
    or a cast -- but `text()` reads `:name` as a bind parameter, which turned
    `'{"a":1}'` into "a value is required for bind parameter '1'". Escaping
    every colon is safe precisely because there is nothing here to bind.
    """
    return text(rendered_sql.replace(":", r"\:"))


def _postgres_detail(exc: SQLAlchemyError) -> str:
    """PostgreSQL's own words, without the driver wrapper around them.

    `str(exc)` reads
    ``(sqlalchemy.dialects.postgresql.asyncpg.ProgrammingError) <class
    'asyncpg.exceptions.UndefinedColumnError'>: column "span_kindd" does not
    exist``, of which only the tail is about the caller's query. The rest names
    our driver stack, which tells them nothing they can act on and invites them
    to debug the server instead of their SQL.

    The HINT line is kept when present -- PostgreSQL suggests the column the
    caller probably meant, which is the most useful sentence in the whole error.
    """
    raw = str(getattr(exc, "orig", exc))
    lines = [line.strip() for line in raw.splitlines() if line.strip()]
    kept = [line for line in lines if not line.upper().startswith(("DETAIL:", "CONTEXT:"))]
    detail = "; ".join(kept) if kept else raw
    if ">: " in detail:
        detail = detail.split(">: ", 1)[1]
    return " ".join(detail.split()).rstrip(".") + "."


def _estimated_rows(plan_json: list[dict[str, Any]]) -> Optional[int]:
    """The planner's estimate for the statement before any LIMIT truncates it.

    `Plan Rows` on the top node is the estimate *after* truncation, and a LIMIT
    is always present -- injected when the caller wrote none. Read there, the
    figure is `min(estimate, limit)`, so any query the planner expects to fill
    the page reports `row_limit + 1`: the caller's own argument handed back,
    carrying nothing about the data. Descending past the Limit node answers the
    question worth asking instead, which is how much the statement would return
    if it were not cut off, and therefore whether narrowing it is worthwhile.

    It remains an estimate. PostgreSQL keeps no statistics for an expression
    over a JSON path, so a GROUP BY on one can be out by a large factor, and the
    field is named in the tool's output schema as an estimate for that reason.
    """
    node = plan_json[0].get("Plan", {})
    if node.get("Node Type") == "Limit":
        children = node.get("Plans") or []
        if children:
            node = children[0]
    rows = node.get("Plan Rows")
    return int(rows) if isinstance(rows, (int, float)) else None


async def _execute_postgres(
    db: DbSessionFactory,
    rendered_sql: str,
    *,
    allowlist: Allowlist,
    validate_only: bool,
    ctx: RewriteContext,
) -> ExecuteResult:
    estimated_rows: Optional[int] = None
    backend_validated = False
    if _PYFORMAT_MARKER.search(rendered_sql):
        # Refused rather than executed. The alternative to the compiler is
        # `exec_driver_sql`, which SQLAlchemy forbids with a server-side cursor
        # -- and that cursor is what bounds memory here, since a row limit of
        # 5000 says nothing about row width. Losing the bound to accommodate a
        # rare literal is the worse trade, so this is a clean refusal rather
        # than a KeyError escaping the error envelope.
        raise AnalyticsSqlError(
            code=ErrorCode.UNSUPPORTED_SYNTAX,
            message=(
                "A string literal of the form %(name)s cannot be executed on PostgreSQL, "
                "because the driver cannot tell it from a query parameter. Build the same "
                "value by concatenation, for example '%' || '(name)s'."
            ),
        )
    async with db.read() as session:
        await session.execute(text("SET TRANSACTION READ ONLY"))
        # Pinned rather than inherited. A naive literal is read in the session
        # zone, so the same statement answered differently on two deployments
        # whose servers were configured differently -- and returned timestamps
        # rendered in whatever zone the server happened to hold.
        await session.execute(text("SET LOCAL TimeZone = 'UTC'"))
        await session.execute(text(f"SET LOCAL statement_timeout = '{PG_STATEMENT_TIMEOUT_MS}'"))
        await session.execute(text("SET LOCAL work_mem = '64MB'"))
        await session.execute(text("SET LOCAL temp_file_limit = '512MB'"))

        # EXPLAIN resolves names, so a name error surfaces here rather than at
        # the statement below and needs the same mapping. PostgreSQL's own text
        # is passed through: it describes the caller's query against tables they
        # were shown, so there is nothing to withhold. Most typos no longer
        # reach this point -- the column allowlist refuses them first -- but an
        # unqualified name beside a table-valued function still does.
        try:
            explain = await session.execute(
                _as_text(f"EXPLAIN (VERBOSE, FORMAT JSON) {rendered_sql}")
            )
        except SQLAlchemyError as exc:
            detail = _postgres_detail(exc)
            logger.debug("analytics sql: postgres plan resolution failed - %s", exc)
            raise AnalyticsSqlError(
                code=ErrorCode.EXECUTION_ERROR,
                message=(
                    f"The database could not resolve the statement: {detail} "
                    "describeSqlSchema lists the columns each table exposes."
                ),
            ) from exc
        plan_raw = explain.scalar()
        if isinstance(plan_raw, list):
            plan_json = cast(list[dict[str, Any]], plan_raw)
        elif isinstance(plan_raw, (str, bytes, bytearray)):
            decoded_plan = json.loads(plan_raw)
            if not isinstance(decoded_plan, list):
                raise AnalyticsSqlError(
                    code=ErrorCode.PLAN_VERIFICATION_FAILED,
                    message="PostgreSQL returned an invalid query plan.",
                )
            plan_json = cast(list[dict[str, Any]], decoded_plan)
        else:
            raise AnalyticsSqlError(
                code=ErrorCode.PLAN_VERIFICATION_FAILED,
                message="PostgreSQL returned an invalid query plan.",
            )
        verify_postgres_plan(plan_json, allowlist=allowlist, schema=allowlist.pg_schema)
        estimated_rows = _estimated_rows(plan_json)
        backend_validated = True

        if validate_only:
            return ExecuteResult(
                envelope=_success_envelope(
                    columns=[],
                    rows=[],
                    row_count=0,
                    partial=False,
                    ctx=ctx,
                    backend_validated=True,
                    estimated_rows=estimated_rows,
                )
            )

        try:
            result = await session.stream(_as_text(rendered_sql))
            columns, rows, partial, notes = await _consume_stream(result, row_limit=ctx.row_limit)
        except AnalyticsSqlError:
            raise
        except Exception as exc:
            # Without a handler here every driver error reaches the caller as an
            # unhandled internal failure -- and the envelope advertises
            # `statement_timeout` as the backstop, which is only true if a
            # timeout can be mapped to ErrorCode.TIMEOUT.
            #
            # Broader than SQLAlchemyError on purpose. SQLAlchemy wraps driver
            # errors raised by `execute()`, but not those raised while iterating
            # a server-side cursor -- and the deadline fires during iteration,
            # which is the only path a runaway query takes. So
            # `asyncpg.QueryCanceledError` arrived here unwrapped and TIMEOUT
            # stayed unreachable on exactly the queries it exists for.
            # `asyncio.CancelledError` derives from BaseException and so is
            # still not caught, which is what keeps client disconnects
            # propagating rather than being reported as a query failure.
            message = str(exc).lower()
            if "statement timeout" in message or "canceling statement" in message:
                raise AnalyticsSqlError(code=ErrorCode.TIMEOUT, message="Query timed out.") from exc
            if (attributed := _rewrite_attribution(exc, ctx)) is not None:
                logger.error("analytics sql: rewrite produced an unresolvable column - %s", exc)
                raise attributed from exc
            logger.error("analytics sql: postgres execution failed - %s", exc)
            raise AnalyticsSqlError(
                code=ErrorCode.EXECUTION_ERROR,
                message=(
                    "The statement was accepted but the database could not run it. "
                    "The server log records the underlying error. "
                    "validate_only=true reports resolution errors without executing."
                ),
            ) from exc
        return ExecuteResult(
            envelope=_success_envelope(
                columns=columns,
                rows=rows,
                row_count=len(rows),
                partial=partial,
                ctx=ctx,
                backend_validated=backend_validated,
                estimated_rows=estimated_rows,
                notes=notes,
            )
        )


# `no such column: ts.start_time` on SQLite, `column ts.start_time does not
# exist` on PostgreSQL. Both may qualify the name; the qualifier is the relation
# the rewrite attached itself to and is worth repeating back.
_UNRESOLVED_COLUMN = re.compile(
    r"(?:no such column:\s*|column\s+)\"?(?:(?P<qualifier>[\w$]+)\.)?(?P<column>[\w$]+)\"?",
    re.IGNORECASE,
)


def _rewrite_attribution(exc: BaseException, ctx: RewriteContext) -> Optional[AnalyticsSqlError]:
    """Blame the rewrite that introduced an unresolvable column, when one did.

    A rewrite that substitutes an advertised column for an expression over real
    ones produces valid SQL against the table it was written for and invalid SQL
    against a relation that projects the advertised name and nothing else. The
    engine reports the column the rewrite wrote; only this layer knows the
    caller never wrote it, which rewrite did, and what to write instead.
    """
    match = _UNRESOLVED_COLUMN.search(str(exc))
    if match is None:
        return None
    column = match.group("column")
    qualifier = match.group("qualifier")
    # Matched against what a substitution actually wrote, qualifier included.
    # Keying on the bare column name instead blamed a rewrite for the caller's
    # own mistake: `id`, `start_time` and `end_time` are ordinary column names,
    # so an unrelated typo like `q.id` drew "this is a defect in the rewrite"
    # whenever the node-id pass had fired anywhere in the statement.
    written = f"{qualifier}.{column}" if qualifier else column
    rewrite_name = ctx.substituted_columns.get(written)
    if rewrite_name is not None:
        relation = f"`{qualifier}`" if qualifier else "the relation it was selected from"
        return AnalyticsSqlError(
            code=ErrorCode.EXECUTION_ERROR,
            message=(
                f"`{rewrite_name}` is computed per row rather than stored, so selecting it "
                f"is rewritten into an expression over `{column}`, which {relation} does not "
                f"provide. Read `{rewrite_name}` directly from the table that has it rather "
                f"than through a CTE or subquery, or give it another name where you "
                f"select it and refer to that name instead. This is a defect in the "
                f"rewrite, not in your statement."
            ),
            identifiers=(rewrite_name,),
        )
    return None


# sqlean ships its own DB-API module rather than re-exporting the standard
# library's, so `sqlean.dbapi2.OperationalError` is a distinct class and is *not*
# a subclass of `sqlite3.OperationalError`. Catching only the latter silently
# disabled every mapping below: timeouts were never reported as timeouts, the
# authorizer's recorded denial never reached the caller, and an ordinary bad
# column name surfaced as an unhandled driver exception instead of guidance.
# Both are listed because the connection factory is chosen at runtime.
_SQLITE_RUNTIME_ERRORS: tuple[type[BaseException], ...] = (
    sqlite3.OperationalError,
    sqlean.dbapi2.OperationalError,
    sqlite3.DatabaseError,
    sqlean.dbapi2.DatabaseError,
)


async def _execute_sqlite_file(
    db_path: str,
    rendered_sql: str,
    *,
    allowlist: Allowlist,
    validate_only: bool,
    ctx: RewriteContext,
) -> ExecuteResult:
    allowed_functions = sqlite_authorizer_functions(allowlist)
    denials: list[_Denial] = []
    # Shared with the coroutine awaiting the worker, which is the only place
    # that learns the caller has gone away. Scoped inside `run` it could only
    # ever be set by the worker itself, after the query it was meant to
    # interrupt had already finished.
    cancelled = threading.Event()

    def run() -> tuple[list[str], list[list[Any]], bool, list[str], bool]:
        # Its own connection rather than db.read(), because the authorizer and
        # progress handler below are per-connection and must not outlive the
        # statement: on a pooled connection the next caller would inherit them,
        # or they would be stripped mid-query. mode=ro is fixed at open time and
        # cannot be imposed afterwards. sqlean, not the standard library, so the
        # function set matches what the allowlist was verified against.
        conn = sqlean.connect(f"file:{db_path}?mode=ro", uri=True)

        # SQLite has no statement_timeout, so the only way to bound a running
        # query is to interrupt it from the progress handler. Checking only the
        # cancellation flag was not enough: that flag is set in the `finally`
        # below, which runs *after* execution returns, so it could never fire
        # during a long query. A costly statement could therefore run without
        # limit, and since SQLite's semaphore width is 1, block every other
        # analytics query behind it.
        deadline = time.monotonic() + SQLITE_TIMEOUT_SECONDS

        def progress_handler() -> int:
            if cancelled.is_set() or time.monotonic() >= deadline:
                return 1
            return 0

        conn.set_progress_handler(progress_handler, 10000)
        conn.set_authorizer(
            _sqlite_authorizer(
                allowlist.tables,
                allowed_functions,
                denials,
                frozenset(ctx.introduced_relations),
            )
        )
        try:
            conn.execute(f"EXPLAIN {rendered_sql}")
            if validate_only:
                return [], [], False, [], True
            cursor = conn.execute(rendered_sql)
            columns = [d[0] for d in (cursor.description or [])]
            rows: list[list[Any]] = []
            partial = False
            notes: list[str] = []
            lossy: set[str] = set()
            total_bytes = 0
            for row in cursor:
                normalized = normalize_row_values(list(row), lossy)
                encoded = json.dumps(normalized, default=str).encode("utf-8")
                if len(encoded) > BYTE_LIMIT:
                    raise AnalyticsSqlError(
                        code=ErrorCode.RESULT_VALUE_TOO_LARGE,
                        message="A result row exceeds the encoded byte limit.",
                    )
                # Identical to the Postgres consumer, deliberately. These two
                # loops answer the same question about the same limits, and when
                # one appended before checking and the other after, the same
                # query stopped one row apart depending on the backend and the
                # two reported it in different words.
                if total_bytes + len(encoded) > MAX_RESPONSE_BYTES:
                    partial = True
                    notes.append("response byte limit reached")
                    break
                total_bytes += len(encoded)
                rows.append(normalized)
                if len(rows) > ctx.row_limit:
                    rows.pop()
                    partial = True
                    notes.append("row_limit reached")
                    break
            # Each conversion produces a value that looks ordinary, so the
            # only place the narrowing can be seen is here.
            notes.extend(LOSSY_CONVERSION_NOTES[name] for name in sorted(lossy))
            return columns, rows, partial, notes, True
        finally:
            cancelled.set()
            conn.set_progress_handler(None, 0)
            conn.close()

    try:
        columns, rows, partial, notes, backend_validated = await asyncio.to_thread(run)
    except asyncio.CancelledError:
        # A cancelled await abandons the worker; it does not stop it. Python has
        # no safe way to kill a thread, so without this the query runs on to the
        # full deadline while its semaphore slot has already been handed to
        # someone else -- and with SQLite's width of one, the serialisation this
        # module promises quietly stops holding for up to thirty seconds.
        #
        # Setting the flag here, from the event loop, is what the flag was for:
        # the progress handler observes it within its step interval and asks
        # SQLite to abort. Until now it was only ever set from inside the
        # worker's own `finally`, which runs after the query has finished and so
        # could never interrupt anything.
        cancelled.set()
        raise
    except AnalyticsSqlError:
        raise
    except _SQLITE_RUNTIME_ERRORS as exc:
        message = str(exc).lower()
        if "timeout" in message or "interrupted" in message:
            raise AnalyticsSqlError(code=ErrorCode.TIMEOUT, message="Query timed out.") from exc
        # A refusal by the authorizer reaches the driver as an ordinary operational
        # error, so without this the caller is told only that something failed. The
        # authorizer recorded which identifier it rejected; report that instead.
        if denials:
            denial = denials[-1]
            raise AnalyticsSqlError(
                code=denial.code,
                message=denial.message,
                identifiers=(denial.identifier,),
            ) from exc
        # A column the caller never wrote, put there by a rewrite. Attributable
        # with certainty, so it is answered rather than logged as unclassified.
        if (attributed := _rewrite_attribution(exc, ctx)) is not None:
            logger.error("analytics sql: rewrite produced an unresolvable column - %s", exc)
            raise attributed from exc
        # Reached only when no denial was recorded and the message is not a
        # timeout, so the cause is unknown. `DatabaseError` is caught because an
        # authorizer refusal arrives as one, but it also covers programming and
        # corruption errors, and those must not be reported as though the caller
        # mistyped a column. Logged at error so a malformed database or a bug of
        # ours leaves a trace rather than being answered as bad SQL.
        logger.error("analytics sql: unclassified database error - %s", exc)
        # SQLite's own words, as PostgreSQL's are already passed through. The
        # commonest arrival here is an unqualified column two joined tables both
        # offer, which admission cannot refuse and whose message names only the
        # caller's own identifier -- withholding it turned an ordinary mistake
        # into an un-actionable answer on one backend and a precise one on the
        # other, which is the divergence class this surface exists to avoid.
        #
        # `validate_only` is not offered as a remedy here. It runs the same
        # EXPLAIN on this backend and returns this same message, so naming it
        # sends the caller round a loop that cannot tell them anything new.
        raise AnalyticsSqlError(
            code=ErrorCode.EXECUTION_ERROR,
            message=(f"The statement was accepted but the database could not run it: {exc}"),
        ) from exc

    return ExecuteResult(
        envelope=_success_envelope(
            columns=columns,
            rows=rows,
            row_count=len(rows),
            partial=partial,
            ctx=ctx,
            backend_validated=backend_validated,
            estimated_rows=None,
            notes=notes,
        )
    )


async def _consume_stream(
    result: Any,
    *,
    row_limit: int,
) -> tuple[list[str], list[list[Any]], bool, list[str]]:
    # Taken from the cursor rather than from the first row, so an empty result
    # still reports its shape. Learning them from row one meant a query that
    # matched nothing came back with no columns at all, leaving a caller unable
    # to tell "no rows" from "no such columns" -- and disagreeing with SQLite,
    # which reads them from the cursor description either way.
    columns: list[str] = list(getattr(result, "keys", lambda: [])())
    rows: list[list[Any]] = []
    partial = False
    notes: list[str] = []
    lossy: set[str] = set()
    total_bytes = 0
    async for row in result:
        if not columns:
            columns = list(row._fields) if hasattr(row, "_fields") else list(row.keys())
        values = normalize_row_values(list(row), lossy)
        encoded = json.dumps(values, default=str).encode("utf-8")
        if len(encoded) > BYTE_LIMIT:
            raise AnalyticsSqlError(
                code=ErrorCode.RESULT_VALUE_TOO_LARGE,
                message="A result row exceeds the encoded byte limit.",
            )
        # The per-row cap bounds one row; only this bounds the answer. Without
        # it a permitted row_limit of wide rows can be assembled entirely in
        # memory before anything checks the total, which the per-row limit is
        # too small to prevent and the row limit is too large to.
        # Checked before appending, so the assembled response never exceeds the
        # ceiling. Appending first overshoots by a whole row, which had the two
        # backends disagree about the same limit.
        if total_bytes + len(encoded) > MAX_RESPONSE_BYTES:
            partial = True
            notes.append("response byte limit reached")
            break
        total_bytes += len(encoded)
        rows.append(values)
        if len(rows) > row_limit:
            # The extra row the rewrite asked for. Its arrival is the proof of
            # truncation; it is dropped rather than returned.
            rows.pop()
            partial = True
            notes.append("row_limit reached")
            break
    notes.extend(LOSSY_CONVERSION_NOTES[name] for name in sorted(lossy))
    return columns, rows, partial, notes


def _success_envelope(
    *,
    columns: list[str],
    rows: list[list[Any]],
    row_count: int,
    partial: bool,
    ctx: RewriteContext,
    backend_validated: bool,
    estimated_rows: Optional[int],
    notes: Optional[list[str]] = None,
) -> dict[str, Any]:
    # Only what varies. Every field here can differ between two calls, so a
    # reader who skips one loses information; anything constant -- the caps, the
    # read-only guarantee, the runtime backstop, the areas -- is a property of
    # the surface and is stated once by describeSqlSchema instead of repeated on
    # every answer. Before that split, a one-row result was 696 bytes of which
    # 53 were the row and 401 could not have taken another value.
    envelope: dict[str, Any] = {
        "columns": columns,
        "rows": rows,
        "row_count": row_count,
        "row_count_is_partial": partial,
        "applied": {
            "row_limit": ctx.row_limit,
            # Which SQL to write. Measured across cold-agent runs as the field
            # callers act on most after the rows themselves.
            "dialect": ctx.dialect,
            # Which server-side transforms fired. Names the passes, not what
            # they did -- a caller that needs the latter reads `executed` in the
            # server log.
            "rewrites": list(ctx.applied),
        },
        "backend_validated": backend_validated,
        "notes": list(ctx.notes) + (notes or []),
    }
    # Included only when the text changed, which is the only case it carries
    # information -- and omitting it otherwise keeps a one-row answer small.
    # `rewrites` cannot stand in for this: the generator re-cases, re-spaces,
    # drops comments and respells literals without any pass being recorded.
    if ctx.executed_sql and ctx.executed_sql != ctx.caller_sql:
        envelope["applied"]["executed"] = ctx.executed_sql
    if estimated_rows is not None:
        envelope["estimated_rows"] = estimated_rows
    return envelope

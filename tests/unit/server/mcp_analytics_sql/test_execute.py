from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from decimal import Decimal
from typing import cast

import pytest
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlglot import exp, parse_one

from phoenix.server.mcp_analytics_sql.allowlist import load_allowlist
from phoenix.server.mcp_analytics_sql.errors import AnalyticsSqlError, ErrorCode
from phoenix.server.mcp_analytics_sql.execute import (
    ExecuteParams,
    _estimated_rows,
    _rewrite_attribution,
    _sqlite_read_uri,
    execute_analytics_sql,
    resolve_sqlite_db_path,
)
from phoenix.server.mcp_analytics_sql.normalize import (
    LOSSY_CONVERSION_NOTES,
    normalize_row_values,
)
from phoenix.server.mcp_analytics_sql.rewrite import RewriteContext, rewrite
from phoenix.server.types import DbSessionFactory


async def test_select_count_projects_sqlite(
    analytics_sqlite_db: tuple[DbSessionFactory, str],
) -> None:
    db, db_path = analytics_sqlite_db
    result = await execute_analytics_sql(
        db,
        ExecuteParams(sql="SELECT count(*) AS c FROM projects"),
        sqlite_db_path=db_path,
    )
    assert result.envelope.columns == ["c"]
    assert result.envelope.rows[0][0] == 1


async def test_select_count_projects_postgresql(db: DbSessionFactory) -> None:
    if db.dialect.value != "postgresql":
        pytest.skip("postgresql only")
    result = await execute_analytics_sql(
        db,
        ExecuteParams(sql="SELECT count(*) AS c FROM projects"),
    )
    assert "c" in result.envelope.columns


async def test_denied_table(analytics_sqlite_db: tuple[DbSessionFactory, str]) -> None:
    db, db_path = analytics_sqlite_db
    with pytest.raises(AnalyticsSqlError) as exc:
        await execute_analytics_sql(
            db,
            ExecuteParams(sql="SELECT id FROM users"),
            sqlite_db_path=db_path,
        )
    assert exc.value.code is ErrorCode.RELATION_NOT_ALLOWED


async def test_path_is_resolved_from_db_factory_when_caller_omits_it(
    analytics_sqlite_db: tuple[DbSessionFactory, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Execution must use its session factory instead of process configuration.

    The analytics read opens its own connection, so it needs a filesystem path.
    The MCP tool has only a `DbSessionFactory`, and notebook sessions and CLI
    overrides can intentionally point that factory at a different database than
    the environment. A configuration lookup would silently read the wrong file.
    """
    db, _ = analytics_sqlite_db
    monkeypatch.setenv("PHOENIX_SQL_DATABASE_URL", "sqlite:///:memory:")

    result = await execute_analytics_sql(
        db,
        ExecuteParams(sql="SELECT count(*) AS c FROM projects"),
    )
    assert result.envelope.rows[0][0] == 1


async def test_missing_sqlite_path_is_refused_and_says_so_accurately(
    analytics_sqlite_db: tuple[DbSessionFactory, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The refusal must name the real cause, since it is the only clue a caller gets."""
    from phoenix.server.mcp_analytics_sql import execute as execute_module

    db, _ = analytics_sqlite_db

    async def resolve_no_path(_: DbSessionFactory) -> None:
        return None

    monkeypatch.setattr(execute_module, "resolve_sqlite_db_path", resolve_no_path)

    with pytest.raises(AnalyticsSqlError) as exc:
        await execute_analytics_sql(db, ExecuteParams(sql="SELECT count(*) FROM projects"))
    assert exc.value.code is ErrorCode.BACKEND_UNAVAILABLE
    assert "in-memory" in exc.value.message


def test_sqlite_read_uri_escapes_filename_delimiters() -> None:
    assert _sqlite_read_uri("/tmp/a?b#c.db") == "file:/tmp/a%3Fb%23c.db?mode=ro"


async def test_sqlite_path_discovery_returns_an_analytics_error_when_it_cannot_connect() -> None:
    from phoenix.server.mcp_analytics_sql import execute as execute_module

    class FailingDb:
        @asynccontextmanager
        async def read(self) -> AsyncIterator[None]:
            raise SQLAlchemyError("unavailable")
            yield

    with pytest.raises(AnalyticsSqlError) as exc:
        await resolve_sqlite_db_path(cast(DbSessionFactory, FailingDb()))
    assert exc.value.code is ErrorCode.BACKEND_UNAVAILABLE

    class RawDriverFailingDb:
        @asynccontextmanager
        async def read(self) -> AsyncIterator[None]:
            raise execute_module.sqlean.dbapi2.OperationalError(  # type: ignore[attr-defined]
                "unavailable"
            )
            yield

    with pytest.raises(AnalyticsSqlError) as exc:
        await resolve_sqlite_db_path(cast(DbSessionFactory, RawDriverFailingDb()))
    assert exc.value.code is ErrorCode.BACKEND_UNAVAILABLE


@pytest.mark.postgres_only
async def test_a_mistyped_column_is_reported_not_leaked(db: DbSessionFactory) -> None:
    """The most common caller mistake must not surface as a driver traceback.

    It used to reach the engine, where EXPLAIN resolves names, and returned
    ``(sqlalchemy.dialects.postgresql.asyncpg.ProgrammingError) <class
    'asyncpg.exceptions.UndefinedColumnError'>: ...`` -- naming our driver stack
    and inviting the caller to debug the server instead of the query.

    Admission now refuses it first, since the column policy is an allowlist, so
    the statement never reaches PostgreSQL and its "did you mean" never arrives.
    The suggestion is made here instead, from the manifest -- which knows the
    exposed columns, so it will not propose one the caller cannot read.
    """
    with pytest.raises(AnalyticsSqlError) as caught:
        await execute_analytics_sql(db, ExecuteParams(sql="SELECT span_kindd FROM spans"))
    message = caught.value.message
    assert caught.value.code is ErrorCode.COLUMN_NOT_ALLOWED
    assert "span_kindd" in message
    assert "span_kind" in message, "the suggestion is the useful part"
    # Not the withheld-column wording: that would be false, and would tell the
    # caller to stop rather than to fix the spelling.
    assert "exists but is not part of" not in message
    for leaked in ("sqlalchemy", "asyncpg", "Traceback", "ProgrammingError"):
        assert leaked not in message


@pytest.mark.postgres_only
@pytest.mark.parametrize(
    "sql",
    [
        pytest.param(
            """SELECT count(*) AS n FROM spans WHERE status_message <> '{"a":1}'""",
            id="json-literal",
        ),
        pytest.param(
            "SELECT count(*) AS n FROM spans WHERE name LIKE '% :30%'", id="colon-in-like"
        ),
        pytest.param(
            "SELECT count(*) AS n FROM spans "
            "WHERE (attributes #>> '{session,id}')::varchar IS NULL",
            id="cast-operator",
        ),
        pytest.param(
            # Offset-bearing, because a naive time of day is refused: the zone is
            # ambiguous. The colons this case exists for are unaffected.
            "SELECT count(*) AS n FROM spans WHERE start_time > '2020-01-01 10:30:00+00:00'",
            id="timestamp-literal",
        ),
    ],
)
async def test_colons_in_literals_are_not_read_as_bind_parameters(
    db: DbSessionFactory, sql: str
) -> None:
    """The statement is complete, so every colon in it belongs to the SQL.

    `text()` reads `:name` as a bind parameter, so `'{"a":1}'` came back as
    "a value is required for bind parameter '1'" -- a JSON literal in a
    predicate being exactly what an attributes-oriented surface invites. All
    four of these worked on SQLite, which bypasses the compiler, so it was also
    a silent backend divergence.
    """
    # Every case is an aggregate, so a row comes back regardless of what the
    # table holds -- the assertion is about the literal surviving compilation,
    # not about fixture contents.
    result = await execute_analytics_sql(db, ExecuteParams(sql=sql, row_limit=1))
    assert result.envelope.rows, "the statement returned nothing to check"


@pytest.mark.postgres_only
async def test_a_pyformat_literal_is_refused_rather_than_crashing(db: DbSessionFactory) -> None:
    """`%(name)s` cannot be escaped, so it is refused instead of escaping the envelope.

    SQLAlchemy's asyncpg dialect rewrites its own `%(name)s` markers to `$N` by
    regex over the final SQL, so a literal of that shape raises KeyError inside
    the compiler -- which is not an AnalyticsSqlError, so it bypassed the error
    envelope entirely and reached the caller as an internal failure.

    Executing it would mean `exec_driver_sql`, which SQLAlchemy forbids with the
    server-side cursor that bounds memory here. A refusal that names the
    workaround is the better trade.
    """
    with pytest.raises(AnalyticsSqlError) as caught:
        await execute_analytics_sql(
            db, ExecuteParams(sql="SELECT count(*) AS n FROM spans WHERE name LIKE '%(x)s'")
        )
    assert caught.value.code is ErrorCode.UNSUPPORTED_SYNTAX
    assert "concatenation" in caught.value.message


@pytest.mark.postgres_only
async def test_the_schema_is_resolved_not_assumed(
    db: DbSessionFactory, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Both tools must name the schema Phoenix's ORM actually reads.

    `load_allowlist("sqlite")` returns "public" and only the execute path overrode it,
    so `describeSqlSchema` published indexes belonging to whatever sits in
    `public` while the executor read somewhere else — names and JSON path
    literals from a different instance's tables, and "repeat this spelling"
    advice that was wrong for every entry.

    The execute path was not right either. It used `get_env_database_schema()
    or "public"`, the hardcoded fallback #14172 removed from the usage
    statistics: with the variable unset and the tables reached through
    `search_path`, "public" names a schema that does not hold them.

    Resolution follows that PR: the environment variable when set, otherwise
    the schema an unqualified `projects` reference resolves from. Deliberately
    not `current_schema()`, which reports where a CREATE would land rather than
    where the table is.
    """
    import phoenix.server.mcp_analytics_sql.catalog as catalog

    catalog._SCHEMA_CACHE.clear()
    monkeypatch.setattr(catalog, "get_env_database_schema", lambda: "configured_elsewhere")
    assert await catalog.resolve_pg_schema(db) == "configured_elsewhere"

    # Unset, it must ask the connection rather than assume.
    catalog._SCHEMA_CACHE.clear()
    monkeypatch.setattr(catalog, "get_env_database_schema", lambda: None)
    resolved = await catalog.resolve_pg_schema(db)
    async with db.read() as session:
        actual = await session.scalar(
            text(
                "SELECT pn.nspname FROM pg_class AS pc "
                "JOIN pg_namespace AS pn ON pn.oid = pc.relnamespace "
                "WHERE pc.oid = to_regclass('projects')"
            )
        )
    assert resolved == actual
    catalog._SCHEMA_CACHE.clear()


async def test_a_failed_schema_probe_does_not_cache_the_public_fallback(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import phoenix.server.mcp_analytics_sql.catalog as catalog

    class FailingDb:
        dialect = type("Dialect", (), {"value": "postgresql"})()

        @asynccontextmanager
        async def read(self) -> AsyncIterator[None]:
            raise SQLAlchemyError("temporarily unavailable")
            yield

    catalog._SCHEMA_CACHE.clear()
    monkeypatch.setattr(catalog, "get_env_database_schema", lambda: None)
    try:
        assert await catalog.resolve_pg_schema(cast(DbSessionFactory, FailingDb())) == "public"
        assert catalog._SCHEMA_CACHE == {}
    finally:
        catalog._SCHEMA_CACHE.clear()


async def test_a_pyformat_literal_runs_on_sqlite(
    analytics_sqlite_db: tuple[DbSessionFactory, str],
) -> None:
    """The other half of a declared asymmetry, so it reads as a decision.

    A literal shaped like `%(name)s` is ordinary text. SQLite hands the
    statement to the driver directly, so nothing reinterprets it and the query
    runs. PostgreSQL refuses it, because SQLAlchemy's asyncpg paramstyle
    rewrites its own markers of that shape by regex over the final SQL — see
    the companion test above.

    Asserted rather than left implicit: capability may differ between the
    backends, but an asymmetry nobody wrote down is indistinguishable from a
    gap, and the surface's goal is that no statement admitted on both answers
    differently — not that both admit the same statements.
    """
    db, db_path = analytics_sqlite_db
    result = await execute_analytics_sql(
        db,
        ExecuteParams(sql="SELECT count(*) AS n FROM spans WHERE name LIKE '%(x)s'"),
        sqlite_db_path=db_path,
    )
    assert result.envelope.rows == [[0]]


class TestEstimatedRowsIsReadBelowTheLimit:
    """`Plan Rows` on the top node is the estimate after truncation.

    A LIMIT is always present, injected when the caller wrote none, so the top
    node is a Limit and its estimate is `min(planner estimate, limit)`. Read
    there, every query the planner expects to fill the page reports
    `row_limit + 1` -- the caller's own argument handed back, varying with the
    parameter rather than with the data. Measured against a live deployment
    whose true answer was 15 rows, limits of 10, 50 and 500 produced estimates
    of 11, 51 and 501, and only a limit of 5000 revealed the planner's actual
    figure of 879.
    """

    def test_descends_past_the_limit_node(self) -> None:
        plan = [
            {
                "Plan": {
                    "Node Type": "Limit",
                    "Plan Rows": 501,
                    "Plans": [{"Node Type": "Aggregate", "Plan Rows": 879}],
                }
            }
        ]
        assert _estimated_rows(plan) == 879

    def test_uses_the_top_node_when_no_limit_is_present(self) -> None:
        plan = [{"Plan": {"Node Type": "Seq Scan", "Plan Rows": 42}}]
        assert _estimated_rows(plan) == 42

    def test_a_childless_limit_falls_back_to_its_own_estimate(self) -> None:
        plan = [{"Plan": {"Node Type": "Limit", "Plan Rows": 7}}]
        assert _estimated_rows(plan) == 7

    def test_a_missing_estimate_is_absent_rather_than_guessed(self) -> None:
        assert _estimated_rows([{"Plan": {"Node Type": "Seq Scan"}}]) is None


class TestRewriteAttribution:
    """A column a rewrite introduced is not a column the caller can act on.

    Attribution matches what a substitution actually wrote, qualifier included.
    Keying on the bare column name blamed a rewrite for the caller's own typo:
    `id`, `start_time` and `end_time` are ordinary names a caller writes too.
    """

    @staticmethod
    def _ctx_after(sql: str) -> RewriteContext:
        """A context populated the way production populates it -- by running the
        passes -- rather than by hand, so the test cannot drift from the code."""
        ctx = RewriteContext(allowlist=load_allowlist("sqlite"), dialect="sqlite", row_limit=500)
        rewrite(cast(exp.Expression, parse_one(sql, read="sqlite")), ctx)
        return ctx

    def test_names_the_rewrite_the_column_and_the_workaround(self) -> None:
        ctx = self._ctx_after("SELECT AVG(s.latency_ms) FROM spans s")

        error = _rewrite_attribution(Exception("no such column: s.start_time"), ctx)

        assert error is not None
        assert error.identifiers == ("latency_ms",)
        assert "start_time" in error.message
        assert "`s`" in error.message
        assert "another name" in error.message
        assert "defect in the rewrite" in error.message

    def test_an_unqualified_substitution_is_attributed(self) -> None:
        ctx = self._ctx_after("SELECT latency_ms FROM spans")

        error = _rewrite_attribution(Exception("no such column: start_time"), ctx)

        assert error is not None
        assert error.identifiers == ("latency_ms",)

    def test_a_callers_own_typo_is_not_blamed_on_the_rewrite(self) -> None:
        """`id` is what the node-id pass writes and also an ordinary column name.
        Matching on the name alone answered a caller's mistyped `q.id` with
        "this is a defect in the rewrite", which is the failure this whole
        mechanism exists to prevent."""
        ctx = self._ctx_after("SELECT graphql_node_id FROM projects")
        assert ctx.substituted_columns, "the node-id pass should have recorded what it wrote"

        assert _rewrite_attribution(Exception("no such column: q.id"), ctx) is None

    def test_a_different_qualifier_is_not_attributed(self) -> None:
        ctx = self._ctx_after("SELECT AVG(s.latency_ms) FROM spans s")

        assert _rewrite_attribution(Exception("no such column: zz.start_time"), ctx) is None

    def test_a_column_no_rewrite_introduced_is_not_attributed(self) -> None:
        ctx = self._ctx_after("SELECT AVG(s.latency_ms) FROM spans s")

        assert _rewrite_attribution(Exception("no such column: nonexistent"), ctx) is None

    def test_a_rewrite_that_did_not_run_records_nothing(self) -> None:
        ctx = self._ctx_after("SELECT id FROM spans")

        assert ctx.substituted_columns == {}
        assert _rewrite_attribution(Exception("no such column: s.start_time"), ctx) is None

    async def test_the_shape_that_provoked_this_now_runs(
        self, analytics_sqlite_db: tuple[DbSessionFactory, str]
    ) -> None:
        """Closed by the shared resolver. Pinned so the attribution above is not
        quietly re-covering a regression."""
        db, db_path = analytics_sqlite_db
        result = await execute_analytics_sql(
            db,
            ExecuteParams(
                sql="WITH q AS (SELECT latency_ms FROM spans) SELECT AVG(t.latency_ms) FROM q t"
            ),
            sqlite_db_path=db_path,
        )

        assert result.envelope.rows is not None


class TestDeclaredRelationsShadowingPhoenixTables:
    """A caller CTE named after a Phoenix table is a query, not an incident.

    SQLite authorizer events distinguish a physical table read from a
    statement-local relation. Both a projected column and an aggregate-only
    read must preserve that distinction.
    """

    async def test_a_cte_named_after_a_denied_table_runs(
        self, analytics_sqlite_db: tuple[DbSessionFactory, str]
    ) -> None:
        db, db_path = analytics_sqlite_db
        result = await execute_analytics_sql(
            db,
            ExecuteParams(sql="WITH users AS (SELECT 1 AS n) SELECT n FROM users"),
            sqlite_db_path=db_path,
        )

        assert result.envelope.rows == [[1]]

    async def test_an_aggregate_over_a_shadowing_cte_runs(
        self, analytics_sqlite_db: tuple[DbSessionFactory, str]
    ) -> None:
        """`count(*)` has no column name, so SQLite reports a table-level read."""
        db, db_path = analytics_sqlite_db
        result = await execute_analytics_sql(
            db,
            ExecuteParams(sql="WITH users AS (SELECT 1 AS n) SELECT count(*) FROM users"),
            sqlite_db_path=db_path,
        )

        assert result.envelope.rows == [[1]]

    async def test_a_subquery_alias_cannot_hide_the_base_table(
        self, analytics_sqlite_db: tuple[DbSessionFactory, str]
    ) -> None:
        """Admission must still inspect the forbidden table inside the subquery."""
        db, db_path = analytics_sqlite_db
        with pytest.raises(AnalyticsSqlError) as exc:
            await execute_analytics_sql(
                db,
                ExecuteParams(sql="SELECT count(*) FROM (SELECT id FROM users) AS users"),
                sqlite_db_path=db_path,
            )

        assert exc.value.code is ErrorCode.RELATION_NOT_ALLOWED

    async def test_the_base_table_is_unreachable_through_the_shadow(
        self, analytics_sqlite_db: tuple[DbSessionFactory, str]
    ) -> None:
        """The accept is gated on an unqualified read, and the qualified spelling
        that would reach the base table never gets that far: schema-qualified
        tables are refused at admission on this backend. So while a CTE shadows
        a name, the table behind it cannot be named at all -- a stronger
        guarantee than the gate alone provides."""
        db, db_path = analytics_sqlite_db
        with pytest.raises(AnalyticsSqlError) as exc:
            await execute_analytics_sql(
                db,
                ExecuteParams(sql="WITH users AS (SELECT 1 AS n) SELECT id FROM main.users"),
                sqlite_db_path=db_path,
            )

        assert exc.value.code is ErrorCode.UNSUPPORTED_SYNTAX
        assert "Schema-qualified" in exc.value.message

    async def test_an_unshadowed_denied_table_is_still_denied(
        self, analytics_sqlite_db: tuple[DbSessionFactory, str]
    ) -> None:
        db, db_path = analytics_sqlite_db
        with pytest.raises(AnalyticsSqlError) as exc:
            await execute_analytics_sql(
                db, ExecuteParams(sql="SELECT id FROM users"), sqlite_db_path=db_path
            )

        assert exc.value.code is ErrorCode.RELATION_NOT_ALLOWED


class TestEnvelopeReportsTheExecutedStatement:
    """`rewrites` names the passes that fired, which is a different claim.

    The generator re-cases, re-spaces, drops comments and respells literals with
    no pass recorded, so a caller reading `rewrites` can be told nothing changed
    about a statement that did. See B5.
    """

    async def test_the_executed_sql_is_reported_when_it_differs(
        self, analytics_sqlite_db: tuple[DbSessionFactory, str]
    ) -> None:
        db, db_path = analytics_sqlite_db
        result = await execute_analytics_sql(
            db,
            ExecuteParams(sql="select count(*) as c from projects"),
            sqlite_db_path=db_path,
        )

        executed = result.envelope.applied.executed
        assert executed is not None
        assert executed != "select count(*) as c from projects"
        assert "LIMIT" in executed.upper()

    async def test_it_is_omitted_when_the_text_is_unchanged(
        self, analytics_sqlite_db: tuple[DbSessionFactory, str]
    ) -> None:
        """Omitted rather than echoed, so a small answer stays small."""
        db, db_path = analytics_sqlite_db
        sql = "SELECT count(*) AS c FROM projects LIMIT 500"
        result = await execute_analytics_sql(db, ExecuteParams(sql=sql), sqlite_db_path=db_path)

        if result.envelope.applied.executed is not None:
            assert result.envelope.applied.executed != sql


class TestLossyNormalisationIsReported:
    """Every conversion in the result path narrows, and each looks ordinary.

    An exact decimal and the float nearest it are both just numbers in JSON, and
    replaced bytes are just a string, so the envelope is the only place the
    narrowing can be seen. See C4.
    """

    def test_an_exactly_representable_decimal_is_not_flagged(self) -> None:
        """A note on every decimal trains the reader to skip the field."""
        applied: set[str] = set()

        assert normalize_row_values([Decimal("1.5")], applied) == [1.5]
        assert applied == set()

    def test_a_decimal_that_loses_precision_is_flagged(self) -> None:
        applied: set[str] = set()

        normalize_row_values([Decimal("9007199254740993")], applied)

        assert "decimal_to_float" in applied
        assert "binary floating-point" in LOSSY_CONVERSION_NOTES["decimal_to_float"]

    def test_a_nested_decimal_that_loses_precision_is_flagged(self) -> None:
        applied: set[str] = set()

        assert normalize_row_values([{"costs": [Decimal("9007199254740993")]}], applied) == [
            {"costs": [9007199254740992.0]}
        ]
        assert "decimal_to_float" in applied

    def test_a_non_finite_float_is_flagged(self) -> None:
        applied: set[str] = set()

        assert normalize_row_values([float("inf")], applied) == [None]
        assert "non_finite_to_null" in applied

    def test_undecodable_bytes_are_flagged(self) -> None:
        applied: set[str] = set()

        normalize_row_values([b"\xff\xfe"], applied)

        assert "undecodable_bytes" in applied

    def test_valid_utf8_bytes_are_not_flagged(self) -> None:
        applied: set[str] = set()

        assert normalize_row_values([b"hello"], applied) == ["hello"]
        assert applied == set()

    async def test_the_note_reaches_the_envelope(
        self, analytics_sqlite_db: tuple[DbSessionFactory, str]
    ) -> None:
        db, db_path = analytics_sqlite_db
        result = await execute_analytics_sql(
            db,
            ExecuteParams(sql="SELECT 9e999 AS x FROM projects"),
            sqlite_db_path=db_path,
        )

        assert result.envelope.rows == [[None]]
        assert any("non-finite" in note for note in result.envelope.notes)


class TestSqliteResolutionErrorsAreActionable:
    """PostgreSQL's own words already reach the caller; SQLite's did not.

    An unqualified column two joined tables both offer passes admission -- it is
    not hidden and both tables offer it -- and then fails at the engine. The
    message names only the caller's own identifier, so withholding it made an
    ordinary mistake un-actionable on one backend and precise on the other.
    """

    async def test_an_ambiguous_column_names_itself(
        self, analytics_sqlite_db: tuple[DbSessionFactory, str]
    ) -> None:
        db, db_path = analytics_sqlite_db
        with pytest.raises(AnalyticsSqlError) as exc:
            await execute_analytics_sql(
                db,
                ExecuteParams(
                    sql="SELECT start_time FROM spans JOIN traces ON spans.trace_rowid = traces.id"
                ),
                sqlite_db_path=db_path,
            )

        assert exc.value.code is ErrorCode.EXECUTION_ERROR
        assert "start_time" in exc.value.message
        assert "ambiguous" in exc.value.message.lower()

    async def test_it_no_longer_recommends_validate_only(
        self, analytics_sqlite_db: tuple[DbSessionFactory, str]
    ) -> None:
        """`validate_only` runs the same EXPLAIN here and returns the same
        message, so naming it sent the caller round a loop."""
        db, db_path = analytics_sqlite_db
        with pytest.raises(AnalyticsSqlError) as exc:
            await execute_analytics_sql(
                db,
                ExecuteParams(
                    sql="SELECT start_time FROM spans JOIN traces ON spans.trace_rowid = traces.id"
                ),
                sqlite_db_path=db_path,
            )

        assert "validate_only" not in exc.value.message

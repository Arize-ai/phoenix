import pytest
from sqlalchemy import text

from phoenix.server.mcp_analytics_sql.allowlist import load_allowlist
from phoenix.server.mcp_analytics_sql.errors import AnalyticsSqlError, ErrorCode
from phoenix.server.mcp_analytics_sql.execute import (
    ExecuteParams,
    _estimated_rows,
    _rewrite_attribution,
    execute_analytics_sql,
)
from phoenix.server.mcp_analytics_sql.rewrite import RewriteContext
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
    assert result.envelope["columns"] == ["c"]
    assert result.envelope["rows"][0][0] == 1


async def test_select_count_projects_postgresql(db: DbSessionFactory) -> None:
    if db.dialect.value != "postgresql":
        pytest.skip("postgresql only")
    result = await execute_analytics_sql(
        db,
        ExecuteParams(sql="SELECT count(*) AS c FROM projects"),
    )
    assert "c" in result.envelope["columns"]


async def test_denied_table(analytics_sqlite_db: tuple[DbSessionFactory, str]) -> None:
    db, db_path = analytics_sqlite_db
    with pytest.raises(AnalyticsSqlError) as exc:
        await execute_analytics_sql(
            db,
            ExecuteParams(sql="SELECT id FROM users"),
            sqlite_db_path=db_path,
        )
    assert exc.value.code is ErrorCode.RELATION_NOT_ALLOWED


async def test_path_is_resolved_from_config_when_caller_omits_it(
    analytics_sqlite_db: tuple[DbSessionFactory, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Execution must work without the caller threading the database path through.

    The analytics read opens its own connection, so it needs a filesystem path.
    Every call site having to supply one is a standing invitation to forget, and
    forgetting is indistinguishable at the point of failure from a database that
    genuinely has no path -- both surface as the same refusal. Resolving from
    configuration removes the choice.

    This is a regression test. The tool layer once called through without the
    path, so every file-backed SQLite deployment refused analytics SQL while
    reporting that the database was in-memory.
    """
    db, db_path = analytics_sqlite_db
    monkeypatch.setenv("PHOENIX_SQL_DATABASE_URL", f"sqlite:///{db_path}")

    result = await execute_analytics_sql(
        db,
        ExecuteParams(sql="SELECT count(*) AS c FROM projects"),
    )
    assert result.envelope["rows"][0][0] == 1


async def test_in_memory_is_refused_and_says_so_accurately(
    analytics_sqlite_db: tuple[DbSessionFactory, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The refusal must name the real cause, since it is the only clue a caller gets."""
    db, _ = analytics_sqlite_db
    monkeypatch.setenv("PHOENIX_SQL_DATABASE_URL", "sqlite:///:memory:")

    with pytest.raises(AnalyticsSqlError) as exc:
        await execute_analytics_sql(db, ExecuteParams(sql="SELECT count(*) FROM projects"))
    assert exc.value.code is ErrorCode.BACKEND_UNAVAILABLE
    assert "in-memory" in exc.value.message


@pytest.mark.postgres_only
async def test_a_mistyped_column_is_reported_not_leaked(db: DbSessionFactory) -> None:
    """The most common caller mistake must not surface as a driver traceback.

    EXPLAIN resolves names, so an unknown column fails there rather than at the
    statement below it -- and only the statement was wrapped, so this case
    reached the caller as
    ``(sqlalchemy.dialects.postgresql.asyncpg.ProgrammingError) <class
    'asyncpg.exceptions.UndefinedColumnError'>: ...``, which names our driver
    stack and invites debugging the server instead of the query.

    PostgreSQL's own text is kept, including the HINT, because it names the
    column and usually suggests the intended one.
    """
    with pytest.raises(AnalyticsSqlError) as caught:
        await execute_analytics_sql(db, ExecuteParams(sql="SELECT span_kindd FROM spans"))
    message = caught.value.message
    assert caught.value.code is ErrorCode.EXECUTION_ERROR
    assert "span_kindd" in message
    assert "span_kind" in message, "PostgreSQL's suggestion is the useful part"
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
    assert result.envelope["rows"], "the statement returned nothing to check"


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

    `load_allowlist()` returns "public" and only the execute path overrode it,
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
    assert result.envelope["rows"] == [[0]]


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

    The shapes that used to reach this are closed by the shared resolver, so the
    attribution is exercised directly: it is the backstop for the next rewrite
    that substitutes an advertised column, not a description of a live defect.
    See C6 and Part 8 of the correctness boundary document.
    """

    @staticmethod
    def _ctx(applied: list[str]) -> RewriteContext:
        ctx = RewriteContext(allowlist=load_allowlist(), dialect="sqlite", row_limit=500)
        ctx.applied.extend(applied)
        return ctx

    def test_names_the_rewrite_the_column_and_the_workaround(self) -> None:
        error = _rewrite_attribution(
            Exception("no such column: t.start_time"), self._ctx(["latency_ms"])
        )

        assert error is not None
        assert error.identifiers == ("latency_ms",)
        assert "latency_ms" in error.message
        assert "start_time" in error.message
        assert "`t`" in error.message
        assert "another name" in error.message
        assert "defect in the rewrite" in error.message

    def test_unqualified_column_is_attributed_too(self) -> None:
        error = _rewrite_attribution(
            Exception("no such column: start_time"), self._ctx(["latency_ms"])
        )

        assert error is not None
        assert error.identifiers == ("latency_ms",)

    def test_postgres_wording_is_recognised(self) -> None:
        error = _rewrite_attribution(
            Exception("column q.id does not exist"), self._ctx(["graphql_node_id"])
        )

        assert error is not None
        assert error.identifiers == ("graphql_node_id",)

    def test_a_column_no_rewrite_introduced_is_not_attributed(self) -> None:
        assert (
            _rewrite_attribution(
                Exception("no such column: nonexistent"), self._ctx(["latency_ms"])
            )
            is None
        )

    def test_a_rewrite_that_did_not_run_is_not_blamed(self) -> None:
        """`start_time` is a real column; without the rewrite applied, an error
        naming it is the caller's own."""
        assert (
            _rewrite_attribution(Exception("no such column: t.start_time"), self._ctx([])) is None
        )

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

        assert result.envelope["rows"] is not None


class TestDeclaredRelationsShadowingPhoenixTables:
    """A caller CTE named after a Phoenix table is a query, not an incident.

    The authorizer denied it as an admission bypass and logged it as such, so a
    reader of the log could not tell a real bypass from this. See F1.
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

        assert result.envelope["rows"] == [[1]]

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

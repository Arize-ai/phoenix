"""Every construct admission accepts must survive all the way to a result.

Admission and the SQLite authorizer are separate gates applied at different
stages, and they see different things. Admission inspects the statement the
caller wrote, as parsed. The authorizer inspects the statement after rendering,
which changes spelling: ``json_extract(x, path)`` is emitted as the ``->``
operator, and functions the caller never named appear under their SQL names.

When the two disagree, a caller writes something the surface documents as
allowed and receives a sanitized failure that names nothing. That is worse than
a refusal, because there is no way to tell a bug from a policy decision.

These tests close the gap by executing rather than inspecting. Every construct
listed as permitted runs against a real database and has to come back with rows.
Add a case whenever the function or expression policy grows -- a construct that
is allowed but has never been executed is only theoretically allowed.
"""

from __future__ import annotations

import asyncio
import threading
from typing import Any

import pytest
from sqlalchemy import text

from phoenix.server.mcp_analytics_sql.errors import AnalyticsSqlError
from phoenix.server.mcp_analytics_sql.execute import (
    ExecuteParams,
    ExecutionSemaphore,
    execute_analytics_sql,
)
from phoenix.server.mcp_analytics_sql.teaching import describe_sql_schema
from phoenix.server.types import DbSessionFactory

# Statements are shaped so that a policy failure is the only plausible cause of an
# error: each selects from an allowlisted table with a trivial predicate, so
# nothing here can fail on data.
PERMITTED = [
    pytest.param("SELECT count(*) AS v FROM spans", id="count"),
    pytest.param("SELECT sum(cumulative_error_count) AS v FROM spans", id="sum"),
    pytest.param("SELECT avg(cumulative_error_count) AS v FROM spans", id="avg"),
    pytest.param("SELECT min(start_time) AS v FROM spans", id="min"),
    pytest.param("SELECT max(start_time) AS v FROM spans", id="max"),
    pytest.param("SELECT round(cumulative_error_count) AS v FROM spans", id="round"),
    pytest.param("SELECT ceil(cumulative_error_count) AS v FROM spans", id="ceil"),
    pytest.param("SELECT floor(cumulative_error_count) AS v FROM spans", id="floor"),
    pytest.param("SELECT sign(cumulative_error_count) AS v FROM spans", id="sign"),
    pytest.param("SELECT coalesce(parent_id, 'x') AS v FROM spans", id="coalesce"),
    pytest.param("SELECT nullif(span_kind, 'LLM') AS v FROM spans", id="nullif"),
    pytest.param("SELECT CAST(cumulative_error_count AS TEXT) AS v FROM spans", id="cast"),
    pytest.param(
        "SELECT CASE WHEN cumulative_error_count > 0 THEN 1 ELSE 0 END AS v FROM spans",
        id="case",
    ),
    pytest.param("SELECT unixepoch(start_time) AS v FROM spans", id="unixepoch"),
    # Relations that exist only inside the statement. SQLite may report a column
    # read against a derived relation's alias rather than against the table under
    # it, and the table check then sees a relation nobody allowlisted. The join
    # is load-bearing -- a single-table select reports reads against `spans` and
    # never exercises this at all.
    pytest.param(
        "SELECT s.name AS span_name, COUNT(*) AS v FROM span_annotations sa "
        "JOIN spans s ON s.id = sa.span_rowid GROUP BY span_name",
        id="derived-alias-reported-instead-of-table",
    ),
    pytest.param(
        "SELECT sp.nm AS v FROM (SELECT s.name AS nm FROM spans s) sp GROUP BY sp.nm",
        id="caller-written-subquery-alias",
    ),
    pytest.param("SELECT date(start_time) AS v FROM spans GROUP BY v", id="date-day-bucket"),
    pytest.param("SELECT datetime(start_time) AS v FROM spans", id="datetime"),
    # SQLite materialises a CTE when it carries GROUP BY, ORDER BY, DISTINCT or
    # LIMIT, and reports reads of the materialised result as reads of a table
    # named after the alias. Admission sees a CTE and permits it; the authorizer
    # saw a table nobody allowlisted and refused it. The inlinable case passed,
    # so the gap was invisible to any corpus that tested CTEs generically --
    # each materialising clause is listed separately for that reason.
    pytest.param(
        "WITH t AS (SELECT span_kind, COUNT(*) AS c FROM spans GROUP BY span_kind) "
        "SELECT COUNT(*) AS v FROM t",
        id="cte-materialised-by-group-by",
    ),
    pytest.param(
        "WITH t AS (SELECT id FROM spans ORDER BY id) SELECT COUNT(*) AS v FROM t",
        id="cte-materialised-by-order-by",
    ),
    pytest.param(
        "WITH t AS (SELECT DISTINCT span_kind FROM spans) SELECT COUNT(*) AS v FROM t",
        id="cte-materialised-by-distinct",
    ),
    pytest.param(
        "WITH t AS (SELECT id FROM spans LIMIT 5) SELECT COUNT(*) AS v FROM t",
        id="cte-materialised-by-limit",
    ),
    pytest.param(
        "WITH t AS (SELECT id FROM spans) SELECT COUNT(*) AS v FROM t",
        id="cte-inlined",
    ),
    pytest.param(
        "SELECT (julianday(end_time) - julianday(start_time)) * 86400000 AS v FROM spans",
        id="julianday-elapsed",
    ),
    # Bucketing a timestamp is the most common analytic grouping there is, and on
    # SQLite the only way to spell it is strftime. It parses to a class named
    # after neither the caller's spelling nor the engine's, so it can be refused
    # by admission while the authorizer is perfectly willing to run it.
    pytest.param(
        "SELECT strftime('%Y-%m-%d %H', start_time) AS v FROM spans GROUP BY v",
        id="strftime-hour-bucket",
    ),
    pytest.param("SELECT latency_ms AS v FROM spans", id="latency_ms-virtual-column"),
    pytest.param("SELECT row_number() OVER (ORDER BY id) AS v FROM spans", id="row_number"),
    pytest.param("SELECT rank() OVER (ORDER BY id) AS v FROM spans", id="rank"),
    pytest.param("SELECT dense_rank() OVER (ORDER BY id) AS v FROM spans", id="dense_rank"),
    pytest.param("SELECT percent_rank() OVER (ORDER BY id) AS v FROM spans", id="percent_rank"),
    pytest.param("SELECT cume_dist() OVER (ORDER BY id) AS v FROM spans", id="cume_dist"),
    pytest.param(
        "SELECT first_value(id) OVER (ORDER BY id) AS v FROM spans",
        id="first_value",
    ),
    pytest.param(
        "SELECT last_value(id) OVER (ORDER BY id) AS v FROM spans",
        id="last_value",
    ),
    pytest.param(
        "SELECT nth_value(id, 1) OVER (ORDER BY id) AS v FROM spans",
        id="nth_value",
    ),
    pytest.param("SELECT ntile(4) OVER (ORDER BY id) AS v FROM spans", id="ntile"),
    # The JSON family. These are the ones that were admitted and then refused:
    # json_extract because rendering turns it into an operator, json_each because
    # a table-valued function reads a pseudo-table rather than calling a function.
    pytest.param("SELECT json_extract(attributes, '$.a.b') AS v FROM spans", id="json_extract"),
    pytest.param("SELECT key AS v FROM spans, json_each(attributes)", id="json_each"),
    pytest.param("SELECT percentile(cumulative_error_count, 50) AS v FROM spans", id="percentile"),
    # Operators SQLite reports to the authorizer as function calls. Admission
    # treats these as predicates and never consults the function policy, so the
    # two layers disagree about what kind of thing they are.
    pytest.param("SELECT count(*) AS v FROM spans WHERE name LIKE '%a%'", id="like"),
    pytest.param("SELECT count(*) AS v FROM spans WHERE name NOT LIKE '%a%'", id="not-like"),
    pytest.param("SELECT count(*) AS v FROM spans WHERE name GLOB 'a*'", id="glob"),
    pytest.param("SELECT * FROM projects", id="star-expansion"),
    pytest.param(
        "SELECT p.name AS v FROM spans s"
        " JOIN traces t ON s.trace_rowid = t.id"
        " JOIN projects p ON t.project_rowid = p.id",
        id="two-hop-join",
    ),
]


@pytest.mark.parametrize("sql", PERMITTED)
async def test_permitted_statement_executes(
    analytics_sqlite_db: tuple[DbSessionFactory, str], sql: str
) -> None:
    """Every permitted construct must produce a row, not merely avoid raising.

    `assert "columns" in envelope` cannot fail: `_success_envelope` always sets
    it, so the assertion held for any call that did not raise, and the fixture
    had no spans -- so every statement here ran over an empty table. That
    verifies the parser and the authorizer agree, and nothing about whether the
    construct computes. A rewrite emitting valid SQL with the wrong semantics
    passes an empty table without complaint.
    """
    db, db_path = analytics_sqlite_db
    result = await execute_analytics_sql(db, ExecuteParams(sql=sql), sqlite_db_path=db_path)
    assert result.envelope.row_count > 0, "executed, but evaluated over nothing"
    assert result.envelope.rows, "no values were returned to check"


async def test_json_extract_survives_being_rendered_as_an_operator(
    analytics_sqlite_db: tuple[DbSessionFactory, str],
) -> None:
    """Named separately because the failure mode is invisible in the caller's SQL.

    The caller writes an allowlisted function. The renderer emits an operator.
    The authorizer gates on what it is shown, so unless it recognises the
    operator as the same capability, a documented function becomes unusable and
    the reported error mentions neither the function nor the operator.
    """
    db, db_path = analytics_sqlite_db
    result = await execute_analytics_sql(
        db,
        ExecuteParams(sql="SELECT json_extract(attributes, '$.llm.model_name') AS m FROM spans"),
        sqlite_db_path=db_path,
    )
    assert result.envelope.columns == ["m"]


async def test_json_extract_returns_a_value_not_json_text(
    analytics_sqlite_db: tuple[DbSessionFactory, str],
) -> None:
    """Executing successfully is not the same as answering correctly.

    SQLite's two JSON accessors differ in return type: one yields the underlying
    value, the other yields JSON text. Aggregates hide the difference -- SUM
    coerces either way -- but MIN, MAX and ORDER BY compare text
    lexicographically, so a larger number can sort below a smaller one.

    Nothing errors when this goes wrong, which is why liveness alone cannot
    catch it: the query runs, returns a row, and the number is wrong. The
    assertion is therefore on the value, using inputs whose lexicographic and
    numeric orderings disagree.
    """
    db, db_path = analytics_sqlite_db
    result = await execute_analytics_sql(
        db,
        ExecuteParams(
            sql=(
                "SELECT MIN(json_extract(j, '$.n')) AS lo, MAX(json_extract(j, '$.n')) AS hi "
                "FROM (SELECT '{\"n\": 1017066}' AS j UNION ALL SELECT '{\"n\": 149740}')"
            )
        ),
        sqlite_db_path=db_path,
    )
    lo, hi = result.envelope.rows[0]
    assert isinstance(lo, (str, int, float))
    assert isinstance(hi, (str, int, float))
    assert (int(lo), int(hi)) == (149740, 1017066), (
        f"got lo={lo!r} hi={hi!r}; lexicographic comparison would give lo=1017066"
    )


async def test_json_type_reports_the_shape_of_a_value(
    analytics_sqlite_db: tuple[DbSessionFactory, str],
) -> None:
    """Shape introspection is how a caller learns what a JSON key holds.

    Attribute keys are not declared anywhere, so after discovering one a caller
    still cannot tell an array from an object from a scalar -- and addressing it
    wrongly returns NULL rather than an error. Being able to ask is what turns
    that from a guess into a lookup.
    """
    db, db_path = analytics_sqlite_db
    result = await execute_analytics_sql(
        db,
        ExecuteParams(sql="SELECT json_type(j, '$.a') AS t FROM (SELECT '{\"a\": [1,2]}' AS j)"),
        sqlite_db_path=db_path,
    )
    assert result.envelope.rows[0][0] == "array"


async def test_graphql_node_id_round_trips(
    analytics_sqlite_db: tuple[DbSessionFactory, str],
) -> None:
    """The id a caller can read back must be the one they can filter by.

    Users only ever see the Relay global id -- in the UI and from the GraphQL
    API -- so the two directions have to agree or the column is worse than
    absent: it would hand back a value that cannot be used to find the row again.
    """
    db, db_path = analytics_sqlite_db
    projected = await execute_analytics_sql(
        db,
        ExecuteParams(sql="SELECT graphql_node_id, name FROM projects"),
        sqlite_db_path=db_path,
    )
    node_id, name = projected.envelope.rows[0]

    matched = await execute_analytics_sql(
        db,
        ExecuteParams(sql=f"SELECT name FROM projects WHERE graphql_node_id = '{node_id}'"),
        sqlite_db_path=db_path,
    )
    assert matched.envelope.rows == [[name]]


async def test_graphql_node_id_predicate_reaches_the_primary_key(
    analytics_sqlite_db: tuple[DbSessionFactory, str],
) -> None:
    """Filtering by node id must become an integer comparison, not a computed one.

    Encoding every row to compare against a literal would turn a key lookup into
    a full scan, and the only way to index around that is an expression index --
    which means a migration. Decoding the literal instead reaches the primary key
    that already exists.
    """
    db, db_path = analytics_sqlite_db
    projected = await execute_analytics_sql(
        db,
        ExecuteParams(sql="SELECT graphql_node_id FROM projects"),
        sqlite_db_path=db_path,
    )
    node_id = projected.envelope.rows[0][0]

    result = await execute_analytics_sql(
        db,
        ExecuteParams(sql=f"SELECT name FROM projects WHERE graphql_node_id = '{node_id}'"),
        sqlite_db_path=db_path,
    )
    # The rewrite reports itself, which is how the predicate form stays checkable
    # without asserting on generated SQL text.
    assert "graphql_node_id" in result.envelope.applied.rewrites


async def test_node_id_for_the_wrong_type_matches_nothing(
    analytics_sqlite_db: tuple[DbSessionFactory, str],
) -> None:
    """A Dataset id used against projects must not silently select a project.

    Both encode an integer, so decoding without checking the type prefix would
    turn `Dataset:1` into `id = 1` and return a project -- a wrong row reported
    with full confidence. The comparison is left intact instead, so it matches
    nothing, which is the truthful answer.
    """
    db, db_path = analytics_sqlite_db
    result = await execute_analytics_sql(
        db,
        ExecuteParams(sql="SELECT name FROM projects WHERE graphql_node_id = 'RGF0YXNldDox'"),
        sqlite_db_path=db_path,
    )
    assert result.envelope.rows == []


async def test_set_operations_get_a_row_limit(
    analytics_sqlite_db: tuple[DbSessionFactory, str],
) -> None:
    """A UNION is admitted, so it must be bounded like any other statement.

    Set operations are the shape that most needs the limit rather than least:
    UNION deduplicates and INTERSECT sorts, so the engine can be made to
    materialise both sides in full even though the caller reads only the first
    page. Stopping the fetch client-side does not undo work already done.
    """
    db, db_path = analytics_sqlite_db
    result = await execute_analytics_sql(
        db,
        ExecuteParams(sql="SELECT id FROM projects UNION SELECT id FROM projects"),
        sqlite_db_path=db_path,
    )
    assert "limit_injection" in result.envelope.applied.rewrites


async def test_a_name_offered_by_both_a_table_and_a_derived_relation_is_refused_by_the_engine(
    analytics_sqlite_db: tuple[DbSessionFactory, str],
) -> None:
    """The premise the `DERIVED_PROJECTION` category rests on.

    Admission marks the reference query-local because a derived relation
    projects the name, and cannot tell that a base table offers it too. That is
    safe only because the engine refuses the collision rather than resolving it
    toward the base table -- which would make the admission a read of a column
    the schema withholds.
    """
    db, db_path = analytics_sqlite_db
    with pytest.raises(AnalyticsSqlError) as caught:
        await execute_analytics_sql(
            db,
            ExecuteParams(sql="SELECT user_id FROM datasets, (SELECT 1 AS user_id) q"),
            sqlite_db_path=db_path,
        )

    assert "ambiguous" in caught.value.message.casefold()


@pytest.mark.postgres_only
async def test_the_same_collision_is_refused_by_postgresql(
    analytics_postgres_db: DbSessionFactory,
) -> None:
    """The other half of the premise `DERIVED_PROJECTION` rests on."""
    with pytest.raises(AnalyticsSqlError) as caught:
        await execute_analytics_sql(
            analytics_postgres_db,
            ExecuteParams(sql="SELECT user_id FROM datasets, (SELECT 1 AS user_id) q"),
        )

    assert "ambiguous" in caught.value.message.casefold()


async def test_queue_slot_is_returned_when_a_waiter_is_cancelled() -> None:
    """A client disconnecting while queued must not consume capacity forever.

    Acquisition happens before the caller's try/finally, so a cancellation while
    waiting on the semaphore unwinds through code that would otherwise never
    decrement the counter. Enough of those and every later request is refused as
    QUEUE_FULL until the process restarts -- a denial of service reachable by
    doing nothing but disconnecting.
    """
    import asyncio

    from phoenix.server.mcp_analytics_sql.execute import ExecutionSemaphore

    semaphore = ExecutionSemaphore()
    await semaphore.acquire("sqlite")
    waiters = [asyncio.create_task(semaphore.acquire("sqlite")) for _ in range(3)]
    await asyncio.sleep(0.05)
    for waiter in waiters:
        waiter.cancel()
    await asyncio.gather(*waiters, return_exceptions=True)

    assert semaphore._waiting["sqlite"] == 0


async def test_queue_slot_is_returned_when_a_waiter_is_cancelled_twice() -> None:
    """One cancellation was survivable; a second during the unwind was not.

    The decrement used to run under the same lock the admission check holds, so
    it awaited inside a `finally` that a cancellation was already unwinding. A
    second cancellation delivered during that await skipped it, and the slot was
    gone for the life of the process -- the identical denial of service the test
    above exists to prevent, reachable whenever the lock happened to be held.

    The comment on that decrement asserted the `finally` made a leak
    impossible. It did not, which is why this case is separate: the single
    cancellation above passed throughout.
    """
    import asyncio

    from phoenix.server.mcp_analytics_sql.execute import ExecutionSemaphore

    semaphore = ExecutionSemaphore()
    await semaphore.acquire("sqlite")
    waiter = asyncio.create_task(semaphore.acquire("sqlite"))
    await asyncio.sleep(0.05)
    assert semaphore._waiting["sqlite"] == 1

    # Hold the guard so anything taking it inside the unwind has to wait, then
    # cancel a second time while it is waiting.
    await semaphore._guard.acquire()
    waiter.cancel()
    await asyncio.sleep(0.05)
    waiter.cancel()
    await asyncio.sleep(0.05)
    semaphore._guard.release()
    await asyncio.gather(waiter, return_exceptions=True)

    assert semaphore._waiting["sqlite"] == 0


async def test_row_limit_is_clamped(
    analytics_sqlite_db: tuple[DbSessionFactory, str],
) -> None:
    """The caller sets the limit, so the default alone protects nothing.

    Rows accumulate in memory before encoding, and the per-cell byte check cannot
    see a response made large by many small rows rather than one big one. An
    authorised caller asking for ten million rows should not be able to decide
    how much memory the server spends answering.
    """
    from phoenix.server.mcp_analytics_sql.execute import MAX_ROW_LIMIT

    db, db_path = analytics_sqlite_db
    result = await execute_analytics_sql(
        db,
        ExecuteParams(sql="SELECT id FROM projects", row_limit=10_000_000),
        sqlite_db_path=db_path,
    )
    assert result.envelope.applied.row_limit == MAX_ROW_LIMIT


NEWLY_ALLOWED = [
    pytest.param("SELECT abs(cumulative_error_count) AS v FROM spans", id="abs"),
    pytest.param("SELECT lower(name) AS v FROM spans", id="lower"),
    pytest.param("SELECT substring(name, 1, 5) AS v FROM spans", id="substring"),
    pytest.param("SELECT lag(id) OVER (ORDER BY id) AS v FROM spans", id="lag"),
    pytest.param("SELECT lead(id) OVER (ORDER BY id) AS v FROM spans", id="lead"),
    pytest.param("SELECT group_concat(name) AS v FROM spans", id="group_concat"),
]


@pytest.mark.parametrize("sql", NEWLY_ALLOWED)
async def test_newly_allowed_function_executes(
    analytics_sqlite_db: tuple[DbSessionFactory, str], sql: str
) -> None:
    """Admitting a function is not the same as being able to run it.

    Each of these was refused until the allowlist was widened, and widening it
    only settles the parser's view. The engine still has to accept the rendered
    spelling, which is not always the one the caller wrote -- group_concat is
    emitted as string_agg on PostgreSQL, from the same node class.
    """
    db, db_path = analytics_sqlite_db
    result = await execute_analytics_sql(db, ExecuteParams(sql=sql), sqlite_db_path=db_path)
    assert result.envelope.row_count > 0, "executed, but evaluated over nothing"


@pytest.mark.parametrize(
    "sql",
    [
        pytest.param("SELECT repeat(name, 1000000) AS v FROM spans", id="repeat"),
        pytest.param("SELECT md5(name) AS v FROM spans", id="md5"),
        pytest.param("SELECT randomblob(100000000) AS v FROM spans", id="randomblob"),
    ],
)
async def test_amplifying_neighbours_stay_denied(
    analytics_sqlite_db: tuple[DbSessionFactory, str], sql: str
) -> None:
    """Widening a family must not widen its neighbours.

    substring, lower and abs are safe because their output is bounded by their
    input. These are their nearest neighbours and are not: each turns a short
    statement into a large value, which is a different property from being a
    string function. Admitting the first group is only defensible while this
    group stays refused.
    """
    from phoenix.server.mcp_analytics_sql.errors import AnalyticsSqlError, ErrorCode

    db, db_path = analytics_sqlite_db
    with pytest.raises(AnalyticsSqlError) as exc:
        await execute_analytics_sql(db, ExecuteParams(sql=sql), sqlite_db_path=db_path)
    assert exc.value.code is ErrorCode.FUNCTION_NOT_ALLOWED


@pytest.mark.parametrize(
    ("row_limit", "expect_rows", "expect_partial"),
    [(4, 4, True), (5, 5, False), (6, 5, False)],
    ids=["one-short-of-all", "exactly-all", "limit-above-all"],
)
async def test_partial_flag_is_honest_at_the_boundary(
    analytics_sqlite_db: tuple[DbSessionFactory, str],
    row_limit: int,
    expect_rows: int,
    expect_partial: bool,
) -> None:
    """A result of exactly N rows must not claim it was truncated.

    While the injected limit equalled the reported one, the row that would prove
    truncation was never fetched, so an exactly-complete result was reported
    identically to a truncated one. An agent acts on that flag by paginating or
    narrowing a query that was already complete. The rewrite now asks for one
    row more than the caller wants and the consumer drops it, which is what
    makes the distinction observable.

    The rows are seeded here and the query is scoped to them by name. A
    boundary test needs to know exactly how many rows exist, so it cannot read
    whatever else the shared fixture happens to hold -- and it must not break
    when that fixture gains rows, which is what happened when spans were added
    to it. Counting only `name = 'p'` makes the count depend on this test alone.
    """
    db, db_path = analytics_sqlite_db
    async with db() as session:
        await session.execute(
            text(
                "INSERT INTO traces (project_rowid, trace_id, start_time, end_time) "
                "VALUES (1, 'partial-probe', '2026-07-30 12:00:00', '2026-07-30 12:00:01')"
            )
        )
        trace_rowid = await session.scalar(
            text("SELECT id FROM traces WHERE trace_id = 'partial-probe'")
        )
        for index in range(5):
            await session.execute(
                text(
                    "INSERT INTO spans (trace_rowid, span_id, name, span_kind, start_time, "
                    "end_time, attributes, events, status_code, status_message, "
                    "cumulative_error_count, cumulative_llm_token_count_prompt, "
                    "cumulative_llm_token_count_completion) "
                    f"VALUES ({trace_rowid}, 'probe-{index}', 'p', 'LLM', "
                    "'2026-07-30 12:00:00', '2026-07-30 12:00:01', '{}', '[]', 'OK', '', 0, 0, 0)"
                )
            )
        await session.commit()

    result = await execute_analytics_sql(
        db,
        ExecuteParams(
            sql="SELECT id FROM spans WHERE name = 'p'",
            row_limit=row_limit,
        ),
        sqlite_db_path=db_path,
    )
    assert result.envelope.row_count == expect_rows
    assert result.envelope.row_count_is_partial is expect_partial


async def test_partial_flag_stays_honest_when_caller_repeats_the_tool_limit(
    analytics_sqlite_db: tuple[DbSessionFactory, str],
) -> None:
    db, db_path = analytics_sqlite_db
    result = await execute_analytics_sql(
        db,
        ExecuteParams(sql="SELECT id FROM spans LIMIT 2", row_limit=2),
        sqlite_db_path=db_path,
    )
    assert result.envelope.row_count == 2
    assert result.envelope.row_count_is_partial is True


async def test_negative_sqlite_limit_cannot_disable_the_work_cap(
    analytics_sqlite_db: tuple[DbSessionFactory, str],
) -> None:
    db, db_path = analytics_sqlite_db
    result = await execute_analytics_sql(
        db,
        ExecuteParams(sql="SELECT id FROM spans ORDER BY name LIMIT -1", row_limit=2),
        sqlite_db_path=db_path,
    )
    assert result.envelope.row_count == 2
    assert result.envelope.row_count_is_partial is True
    assert "limit_injection" in result.envelope.applied.rewrites
    assert result.envelope.applied.executed is not None
    assert "LIMIT 3" in result.envelope.applied.executed


async def test_sqlite_timestamp_subtraction_returns_elapsed_seconds(
    analytics_sqlite_db: tuple[DbSessionFactory, str],
) -> None:
    db, db_path = analytics_sqlite_db
    result = await execute_analytics_sql(
        db,
        ExecuteParams(
            sql=(
                "SELECT end_time - start_time AS duration, latency_ms "
                "FROM spans WHERE span_id = 'span-1'"
            )
        ),
        sqlite_db_path=db_path,
    )
    assert result.envelope.rows
    duration, latency_ms = result.envelope.rows[0]
    assert duration != 0
    assert latency_ms != 0


async def test_no_window_is_imposed_when_none_is_asked_for(
    analytics_sqlite_db: tuple[DbSessionFactory, str],
) -> None:
    """A query with no bounds reads all of history, and the envelope says so.

    The surface used to inject a trailing seven-day window. It could not bound a
    determined caller, since defeating it cost one parameter, and for everyone
    else it answered a different question than the one asked while reporting
    success. Across roughly twenty-five cold-agent runs every caller noticed it
    and worked around it, so it protected nobody and charged everybody a round
    trip. The row and byte caps bound the answer; the statement deadline bounds
    the work.
    """
    db, db_path = analytics_sqlite_db
    result = await execute_analytics_sql(
        db, ExecuteParams(sql="SELECT id FROM spans"), sqlite_db_path=db_path
    )
    # Absent entirely, rather than present with null bounds: reporting a window
    # that was never imposed is what made the old default so easy to miss.
    assert "time_window" not in result.envelope.applied.model_dump(exclude_none=True)
    assert "time_bounds" not in result.envelope.applied.rewrites


async def test_cancelling_a_query_stops_the_worker(
    analytics_sqlite_db: tuple[DbSessionFactory, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A caller going away must stop the work, not merely stop waiting for it.

    `asyncio.to_thread` cancellation abandons the worker; Python has no safe way
    to kill a thread. So the flag the progress handler watches has to be set
    from the event loop, which is the only side that learns the caller is gone.
    Scoped inside the worker it could only be set by the worker itself, after
    the query it was meant to interrupt had already finished — dead code wearing
    the name of a live control.

    Left unstopped the query runs to the full deadline, burning a serialized
    resource nobody is waiting on.

    Rows are seeded here because the shared fixture holds a project and nothing
    else: against an empty table the cartesian below completes before the cancel
    lands, and the test passes while asserting nothing. The `CancelledError` is
    the load-bearing assertion — raising it means the cancel reached a query
    that was genuinely still running.
    """
    from phoenix.server.mcp_analytics_sql import execute as execute_module

    db, db_path = analytics_sqlite_db
    semaphore = ExecutionSemaphore()
    monkeypatch.setattr(execute_module, "EXECUTION_SEMAPHORE", semaphore)
    statement_started = threading.Event()
    close_started = threading.Event()
    allow_close = threading.Event()
    sqlean_module = execute_module.sqlean  # type: ignore[attr-defined]
    real_connect = sqlean_module.connect

    async def wait_for_event(event: threading.Event) -> None:
        for _ in range(100):
            if event.is_set():
                return
            await asyncio.sleep(0.01)
        raise AssertionError("timed out waiting for SQLite worker")

    class GatedConnection:
        def __init__(self, connection: Any) -> None:
            self._connection = connection

        def __getattr__(self, name: str) -> Any:
            return getattr(self._connection, name)

        def set_authorizer(self, *args: Any) -> None:
            statement_started.set()
            self._connection.set_authorizer(*args)

        def close(self) -> None:
            close_started.set()
            allow_close.wait(timeout=1)
            self._connection.close()

    monkeypatch.setattr(
        sqlean_module,
        "connect",
        lambda *args, **kwargs: GatedConnection(real_connect(*args, **kwargs)),
    )

    async with db() as session:
        await session.execute(
            text(
                "INSERT INTO traces (project_rowid, trace_id, start_time, end_time) "
                "VALUES (1, 'cancel-probe', '2026-07-30 12:00:00', '2026-07-30 12:00:01')"
            )
        )
        trace_rowid = await session.scalar(
            text("SELECT id FROM traces WHERE trace_id = 'cancel-probe'")
        )
        for index in range(200):
            await session.execute(
                text(
                    "INSERT INTO spans (trace_rowid, span_id, name, span_kind, start_time, "
                    "end_time, attributes, events, status_code, status_message, "
                    "cumulative_error_count, cumulative_llm_token_count_prompt, "
                    "cumulative_llm_token_count_completion) "
                    f"VALUES ({trace_rowid}, 'cx-{index}', 'p', 'LLM', "
                    "'2026-07-30 12:00:00', '2026-07-30 12:00:01', '{}', '[]', 'OK', '', 0, 0, 0)"
                )
            )
        await session.commit()

    # The predicate is load-bearing. A bare `count(*)` over a cross join is
    # optimised into a product of counts and finishes in milliseconds, so the
    # cancel lands after the query is already done and the test asserts nothing.
    # Forcing per-row evaluation is what keeps it genuinely in flight.
    expensive = (
        "SELECT count(*) AS n FROM spans a, spans b, spans c "
        "WHERE a.span_id <> b.span_id AND b.span_id <> c.span_id"
    )
    task = asyncio.create_task(
        execute_analytics_sql(db, ExecuteParams(sql=expensive), sqlite_db_path=db_path)
    )
    try:
        # The authorizer is installed in the SQLite worker, so this guarantees
        # cancellation reaches a live worker rather than only earlier setup.
        await wait_for_event(statement_started)
        task.cancel()
        with pytest.raises(asyncio.CancelledError):
            await task

        # Hold cleanup briefly so this assertion cannot race the worker's done
        # callback. The timeout and finally prevent a test failure from
        # stranding a worker thread or its semaphore permit.
        await wait_for_event(close_started)
        assert semaphore._locks["sqlite"].locked()
    finally:
        allow_close.set()
        if not task.done():
            task.cancel()
            with pytest.raises(asyncio.CancelledError):
                await task

    # Once cleanup releases that slot, a follow-up must succeed rather than
    # inherit any statement-local authorizer or progress-handler state.
    result = await execute_analytics_sql(
        db, ExecuteParams(sql="SELECT count(*) AS n FROM projects"), sqlite_db_path=db_path
    )
    assert result.envelope.row_count == 1


async def test_envelope_carries_only_fields_that_can_vary(
    analytics_sqlite_db: tuple[DbSessionFactory, str],
) -> None:
    """No constant may ride along on the per-query answer.

    The envelope is paid for on every call, so a field that cannot take a second
    value is pure overhead: a reader who skips it loses nothing. This once cost
    more than half the response -- 728 bytes for an eight-row result of which 166
    were the result -- spent restating the caps, the read-only guarantee, the
    runtime backstop, and an `availability` map hardcoded to report every area
    available. Those belong to the surface, not to any one answer, and
    describeSqlSchema states them once per session under `limits` and
    `guarantees`.

    This test names them explicitly rather than diffing two responses, because
    the failure it guards against is a well-meaning addition: each invariant
    looks harmless on its own and is only expensive in aggregate.
    """
    db, db_path = analytics_sqlite_db
    result = await execute_analytics_sql(
        db,
        ExecuteParams(sql="SELECT span_kind, count(*) FROM spans GROUP BY span_kind"),
        sqlite_db_path=db_path,
    )
    envelope = result.envelope
    banished = {
        "availability",  # every allowlisted area, always "available"
        "consistency",  # the same sentence every call
        "read_only",  # a literal True
        "row_byte_limit",  # module constants
        "response_byte_limit",
        "runtime_backstop",  # derivable from `dialect`, which is present
        "execution_route",
    }
    present = set(envelope.model_dump(exclude_none=True)) | set(
        envelope.applied.model_dump(exclude_none=True)
    )
    assert not (present & banished), f"invariant fields back in the envelope: {present & banished}"

    # `availability` was the only one of these the schema payload also carried,
    # where it likewise restated the area names with a constant value.
    schema = describe_sql_schema(
        area=None, tables=None, detail="brief", search=None, dialect=db.dialect.value
    )
    assert "availability" not in schema
    assert "-- area: telemetry" in schema, "the areas must survive the removal"


NEWLY_ALLOWED_ON_BOTH = [
    pytest.param("SELECT upper(name) AS v FROM spans", id="upper"),
    pytest.param("SELECT length(name) AS v FROM spans", id="length"),
    pytest.param("SELECT current_timestamp AS v FROM spans", id="current_timestamp"),
    pytest.param("SELECT current_date AS v FROM spans", id="current_date"),
]


SQLITE_JSON_SURFACE = [
    pytest.param("SELECT json_array_length('[1,2]') AS v FROM spans", id="array_length"),
    pytest.param("SELECT json_valid(attributes) AS v FROM spans", id="valid"),
    pytest.param("SELECT json_quote(name) AS v FROM spans", id="quote"),
    pytest.param("SELECT json_pretty(attributes) AS v FROM spans", id="pretty"),
    pytest.param("SELECT json(attributes) AS v FROM spans", id="json"),
    pytest.param("SELECT json_array(1, 2) AS v FROM spans", id="array"),
    pytest.param("SELECT json_object('k', name) AS v FROM spans", id="object"),
    pytest.param("SELECT json_group_array(name) AS v FROM spans", id="group_array"),
    pytest.param("SELECT json_group_object(name, id) AS v FROM spans", id="group_object"),
    pytest.param("SELECT json_set(attributes, '$.a', 1) AS v FROM spans", id="set"),
    pytest.param("SELECT json_insert(attributes, '$.a', 1) AS v FROM spans", id="insert"),
    pytest.param("SELECT json_replace(attributes, '$.a', 1) AS v FROM spans", id="replace"),
    pytest.param("SELECT json_remove(attributes, '$.a') AS v FROM spans", id="remove"),
    pytest.param("SELECT json_patch(attributes, '{}') AS v FROM spans", id="patch"),
]


@pytest.mark.parametrize("sql", SQLITE_JSON_SURFACE)
async def test_sqlite_json_surface_executes(
    analytics_sqlite_db: tuple[DbSessionFactory, str], sql: str
) -> None:
    """Every json1 operation admitted for SQLite must also pass the authorizer.

    A function that parses to a node class rather than to a generic call does
    not reach the authorizer set through `allowed_anon_functions`, so it has to
    be named in `SQLITE_AUTHORIZER_FUNCTIONS` directly. `json_object`,
    `json_group_array` and `json_group_object` are all of that kind, and a name
    missing there is admitted by the parser policy and denied by the engine.
    """
    db, db_path = analytics_sqlite_db
    result = await execute_analytics_sql(db, ExecuteParams(sql=sql), sqlite_db_path=db_path)
    assert result.envelope.row_count > 0, "executed, but evaluated over nothing"


POSTGRES_JSON_SURFACE = [
    pytest.param("SELECT attributes ? 'session' AS v FROM spans", id="key_exists"),
    pytest.param("SELECT attributes ?| ARRAY['session','llm'] AS v FROM spans", id="any_key"),
    pytest.param("SELECT attributes ?& ARRAY['session','llm'] AS v FROM spans", id="all_keys"),
    pytest.param("SELECT attributes @> '{}'::jsonb AS v FROM spans", id="contains"),
    pytest.param("SELECT attributes <@ attributes AS v FROM spans", id="contained_by"),
    pytest.param("SELECT attributes @? '$.a' AS v FROM spans", id="path_exists_operator"),
    pytest.param("SELECT jsonb_array_length('[1,2,3]'::jsonb) AS v FROM spans", id="array_length"),
    pytest.param("SELECT jsonb_pretty(attributes) AS v FROM spans", id="pretty"),
    pytest.param("SELECT jsonb_strip_nulls(attributes) AS v FROM spans", id="strip_nulls"),
    pytest.param(
        "SELECT jsonb_path_query_first(attributes, '$.a') AS v FROM spans", id="path_query_first"
    ),
    pytest.param("SELECT jsonb_path_exists(attributes, '$.a') AS v FROM spans", id="path_exists"),
    pytest.param(
        "SELECT jsonb_path_match('{\"a\":1}'::jsonb, '$.a == 1') AS v FROM spans", id="path_match"
    ),
    pytest.param("SELECT jsonb_build_object('k', name) AS v FROM spans", id="build_object"),
    pytest.param("SELECT jsonb_build_array(name, id) AS v FROM spans", id="build_array"),
    pytest.param("SELECT to_jsonb(name) AS v FROM spans", id="to_jsonb"),
    pytest.param("SELECT jsonb_object_keys('{\"a\":1}'::jsonb) AS v FROM spans", id="object_keys"),
    pytest.param(
        "SELECT jsonb_path_query('{\"a\":1}'::jsonb, '$.a') AS v FROM spans", id="path_query"
    ),
    pytest.param("SELECT jsonb_agg(attributes) AS v FROM spans", id="agg"),
    pytest.param("SELECT jsonb_object_agg(name, id) AS v FROM spans", id="object_agg"),
    pytest.param("SELECT jsonb_set(attributes, '{a}', '1') AS v FROM spans", id="set"),
    pytest.param("SELECT jsonb_insert(attributes, '{a}', '1') AS v FROM spans", id="insert"),
    pytest.param("SELECT attributes #- '{a}' AS v FROM spans", id="delete_at_path"),
]


@pytest.mark.parametrize("sql", POSTGRES_JSON_SURFACE)
async def test_postgres_json_surface_executes(
    analytics_postgres_db: DbSessionFactory, sql: str
) -> None:
    """Every JSONB operation admitted for PostgreSQL must survive the plan gate.

    Admission settles only the parser's view. The rendered spelling still has to
    be one PostgreSQL accepts, and a set-returning member has to pass the plan
    gate as well, which recognises a `ProjectSet` by the function names in the
    node's expression text: a name in the anon allowlist but absent from
    `UNNEST_FUNCTIONS` is refused there. That two-layer disagreement is what
    this suite exists to catch.

    Rows are required, not just a clean run. The plan gate gets exercised either
    way, since it runs at `EXPLAIN` before any row is produced -- but a construct
    that executes over an empty table has only been shown to parse and render.
    Where a function is fussy about its input type it is given a literal, so a
    failure here is a policy failure rather than a data one.
    """
    result = await execute_analytics_sql(analytics_postgres_db, ExecuteParams(sql=sql))
    assert result.envelope.row_count > 0, "executed, but evaluated over nothing"


@pytest.mark.parametrize("sql", NEWLY_ALLOWED_ON_BOTH)
async def test_portable_function_classes_are_executable_on_sqlite(
    analytics_sqlite_db: tuple[DbSessionFactory, str], sql: str
) -> None:
    """A class in the portable allowlist must also be in the authorizer's set.

    exp.Upper, exp.Length, exp.CurrentTimestamp and exp.CurrentDate were
    admitted by the parser policy and denied by the SQLite authorizer, so each
    worked on PostgreSQL and was refused here -- the divergence the two
    policies exist to prevent, and the one the allowlist comment claims the
    liveness suite makes fail loudly. It did not, because no case covered them.
    """
    db, db_path = analytics_sqlite_db
    result = await execute_analytics_sql(db, ExecuteParams(sql=sql), sqlite_db_path=db_path)
    assert result.envelope.row_count > 0

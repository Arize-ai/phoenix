"""Verify the Postgres plan gate against plans produced by a live database.

Admission parses caller SQL with SQLGlot and rejects anything outside the
allowlist. The plan gate is a second, independent check: it asks PostgreSQL to
plan the statement and inspects which relations and functions the *engine*
resolved. The two layers use different implementations, so they can disagree,
and the gate is what catches the cases where the parser was wrong.

These tests deliberately skip admission and hand raw plan JSON to
``verify_postgres_plan``. Every payload here is one admission would reject; the
point is to prove the gate refuses it on its own, without relying on the parser
having done its job.

Why the payloads are shaped this way: PostgreSQL represents a set-returning
function with a different plan node type depending on where it appears. In the
FROM clause it becomes a ``Function Scan``; in the select list it becomes a
``ProjectSet``. A gate that walks only one node type silently misses the other,
which is why both forms are covered and why the admit-cases exist to prove the
gate discriminates rather than refusing everything.
"""

import json
from typing import Any, cast

import pytest
from sqlalchemy import text

from phoenix.server.mcp_analytics_sql.allowlist import load_allowlist
from phoenix.server.mcp_analytics_sql.errors import AnalyticsSqlError, ErrorCode
from phoenix.server.mcp_analytics_sql.execute import (
    ExecuteParams,
    _function_identifiers,
    _walk_plan,
    execute_analytics_sql,
    verify_postgres_plan,
)
from phoenix.server.types import DbSessionFactory

pytestmark = pytest.mark.postgres_only


async def _explain(db: DbSessionFactory, sql: str) -> list[dict[str, Any]]:
    """Plan ``sql`` the same way the execute path does and return the plan JSON."""
    async with db.read() as session:
        await session.execute(text("SET TRANSACTION READ ONLY"))
        result = await session.execute(text(f"EXPLAIN (VERBOSE, FORMAT JSON) {sql}"))
        raw = result.scalar()
    if isinstance(raw, list):
        return cast(list[dict[str, Any]], raw)
    if isinstance(raw, (str, bytes, bytearray)):
        return cast(list[dict[str, Any]], json.loads(raw))
    raise TypeError(f"Expected JSON plan payload, got {type(raw).__name__}")


# Each case pairs a payload with the plan node type PostgreSQL uses for it, so a
# planner change that moves a function to a new node type fails loudly here
# instead of quietly widening what the gate accepts.
DENIED_SET_RETURNING = [
    pytest.param("SELECT generate_series(1, 3)", "ProjectSet", id="select-list"),
    pytest.param("SELECT * FROM generate_series(1, 3)", "Function Scan", id="from-clause"),
    pytest.param("SELECT * FROM unnest(ARRAY[1,2,3])", "Function Scan", id="unnest-array"),
]


@pytest.mark.parametrize("sql,expected_node_type", DENIED_SET_RETURNING)
async def test_refuses_disallowed_set_returning_function(
    db: DbSessionFactory, sql: str, expected_node_type: str
) -> None:
    plan = await _explain(db, sql)
    node_types = sorted(str(n.get("Node Type")) for n in _walk_plan(plan[0]["Plan"]))
    assert expected_node_type in node_types, (
        f"expected a {expected_node_type!r} node for {sql!r}; got {node_types}. "
        "The planner represents this function differently now -- teach the gate the new "
        "node type before relaxing this assertion, or it will stop inspecting these plans."
    )

    with pytest.raises(AnalyticsSqlError) as exc:
        verify_postgres_plan(plan, allowlist=load_allowlist("sqlite"), schema="public")
    assert exc.value.code is ErrorCode.PLAN_VERIFICATION_FAILED


async def test_refuses_relation_outside_allowlist(db: DbSessionFactory) -> None:
    """A table the engine resolved but the manifest does not expose must be refused."""
    plan = await _explain(db, "SELECT id FROM users")
    with pytest.raises(AnalyticsSqlError) as exc:
        verify_postgres_plan(plan, allowlist=load_allowlist("sqlite"), schema="public")
    assert exc.value.code is ErrorCode.PLAN_VERIFICATION_FAILED
    assert "users" in exc.value.identifiers


async def test_admits_ordinary_query(db: DbSessionFactory) -> None:
    """Guards the refusal tests: a gate that refused everything would pass them too."""
    plan = await _explain(db, "SELECT id, name FROM projects")
    verify_postgres_plan(plan, allowlist=load_allowlist("sqlite"), schema="public")


async def test_admits_allowed_unnest_in_from_clause(db: DbSessionFactory) -> None:
    """JSON unnesting is allowed, so the gate must distinguish it from other SRFs."""
    plan = await _explain(
        db,
        "SELECT key FROM spans, jsonb_each(spans.attributes) AS e(key, value)",
    )
    verify_postgres_plan(plan, allowlist=load_allowlist("sqlite"), schema="public")


async def test_admits_allowed_unnest_in_select_list(db: DbSessionFactory) -> None:
    """The same allowed function, in the other position it can legally appear.

    A ProjectSet names its functions inside its Output expressions rather than in
    a dedicated field. Reading them out is what lets the gate tell an allowed
    unnest from a disallowed one here; without it the gate can only refuse every
    ProjectSet, which makes a permitted function unusable in this position.
    """
    plan = await _explain(db, "SELECT jsonb_each(attributes) FROM spans")
    verify_postgres_plan(plan, allowlist=load_allowlist("sqlite"), schema="public")


async def test_names_the_function_it_refuses(db: DbSessionFactory) -> None:
    """Refusing for the right reason is what makes the gate an allowlist.

    ``verify_postgres_plan`` refuses a plan either when it identifies a
    disallowed function or when it cannot identify anything at all. Only the
    first behaviour distinguishes allowed functions from disallowed ones, so
    this asserts the identifier is actually extracted rather than inferred from
    the refusal alone -- a gate that refused everything would pass a test that
    only checked for refusal.
    """
    plan = await _explain(db, "SELECT generate_series(1, 3)")
    project_set = [n for n in _walk_plan(plan[0]["Plan"]) if n.get("Node Type") == "ProjectSet"]
    assert project_set, "no ProjectSet node -- planner behaviour changed"
    names = _function_identifiers(project_set[0])
    assert "generate_series" in names, (
        f"extraction returned {names!r} from Output={project_set[0].get('Output')!r}"
    )


@pytest.mark.parametrize(
    "sql",
    [
        pytest.param(
            "SELECT s.graphql_node_id AS a, jsonb_each(s.attributes) AS b FROM spans s",
            id="node-id-with-srf",
        ),
        pytest.param(
            "SELECT s.latency_ms AS a, jsonb_each(s.attributes) AS b FROM spans s",
            id="latency-with-srf",
        ),
        pytest.param(
            """SELECT jsonb_each('{"a(": 1}'::jsonb) AS value FROM spans""",
            id="json-key-with-parenthesis",
        ),
        pytest.param(
            "SELECT coalesce(name, 'fallback('), jsonb_each(attributes) FROM spans",
            id="literal-with-parenthesis",
        ),
        pytest.param(
            "SELECT substring(name, 1, 1), jsonb_each(attributes) FROM spans",
            id="admitted-scalar-beside-srf",
        ),
    ],
)
async def test_the_gate_does_not_refuse_our_own_rewrites(db: DbSessionFactory, sql: str) -> None:
    """A gate that fires on its own side's output trains the reader to ignore it.

    The ProjectSet branch reads expression text, so it saw what the rewriter
    emitted rather than what the caller wrote: `graphql_node_id` becomes
    `encode(convert_to(...))`, and the parenthesis our latency rewrite adds
    turned `EXTRACT(epoch FROM (...))` into a "disallowed function" named
    `from`. Both combinations are ones the schema teaches, and both were
    refused as suspected bypasses -- logged with text saying the refusal
    "should be investigated rather than dismissed".
    """
    # Asserted on the plan being accepted, not on rows: the claim is that the
    # gate stops refusing these, and the test database holds no spans.
    result = await execute_analytics_sql(db, ExecuteParams(sql=sql, row_limit=1))
    assert result.envelope.backend_validated is True


@pytest.mark.parametrize(
    "sql",
    [
        pytest.param("SELECT generate_series(1, 3) AS v FROM spans", id="srf"),
        pytest.param(
            "SELECT md5(s.name) AS a, jsonb_each(s.attributes) AS b FROM spans s",
            id="denied-scalar-beside-srf",
        ),
    ],
)
async def test_the_gate_still_refuses_what_it_should(db: DbSessionFactory, sql: str) -> None:
    """The keyword filter must not have widened the gate, only stopped its noise."""
    with pytest.raises(AnalyticsSqlError):
        await execute_analytics_sql(db, ExecuteParams(sql=sql, row_limit=1))

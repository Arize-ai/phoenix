from datetime import datetime, timedelta, timezone
from typing import Any

import pytest
from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncEngine
from strawberry.relay import GlobalID

from phoenix.db.helpers import SupportedSQLDialect
from phoenix.server.api.types.Project import Project
from phoenix.server.types import DbSessionFactory
from tests.unit.graphql import AsyncGraphQLClient

from ...._helpers import _add_project, _add_span, _add_trace


async def test_newest_first_span_page_reads_backward_along_start_time_index(
    db: DbSessionFactory,
    gql_client: AsyncGraphQLClient,
    request: pytest.FixtureRequest,
) -> None:
    """A newest-first page of spans walks ix_spans_start_time backward and stops once the page
    is full, instead of reading and sorting every span in the time range first (#17898)."""
    if db.dialect is not SupportedSQLDialect.POSTGRESQL:
        pytest.skip("asserts PostgreSQL query plans")
    engine: AsyncEngine = request.getfixturevalue("postgresql_engine")
    now = datetime.now(timezone.utc)
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project)
        for minutes_ago in range(3):
            await _add_span(session, trace, start_time=now - timedelta(minutes=minutes_ago))
    statements: list[tuple[str, Any]] = []

    def capture(
        conn: Any,
        cursor: Any,
        statement: str,
        parameters: Any,
        context: Any,
        executemany: bool,
    ) -> None:
        if "FROM spans JOIN traces" in statement and "LIMIT" in statement:
            statements.append((statement, parameters))

    query = """
      query ($projectId: ID!, $timeRange: TimeRange) {
        node(id: $projectId) {
          ... on Project {
            spans(first: 2, sort: { col: startTime, dir: desc }, timeRange: $timeRange) {
              edges {
                node {
                  id
                }
              }
            }
          }
        }
      }
    """
    event.listen(engine.sync_engine, "before_cursor_execute", capture)
    try:
        response = await gql_client.execute(
            query=query,
            variables={
                "projectId": str(GlobalID(Project.__name__, str(project.id))),
                "timeRange": {"start": (now - timedelta(days=7)).isoformat()},
            },
        )
    finally:
        event.remove(engine.sync_engine, "before_cursor_execute", capture)
    assert not response.errors
    assert response.data is not None
    assert len(response.data["node"]["spans"]["edges"]) == 2
    assert len(statements) == 1
    statement, parameters = statements[0]
    async with engine.connect() as conn:
        # The tables are tiny, so the planner would rather scan them whole and sort. Steer it
        # off those paths to show whether the page's order can be read off the index at all.
        for setting in ("enable_seqscan", "enable_bitmapscan", "enable_sort"):
            await conn.exec_driver_sql(f"SET {setting} = off")
        result = await conn.exec_driver_sql("EXPLAIN " + statement, parameters)
        plan = "\n".join(row[0] for row in result.all())
    assert "Index Scan Backward using ix_spans_start_time on spans" in plan, plan

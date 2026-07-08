from datetime import datetime, timezone

from phoenix.db import models
from phoenix.server.types import DbSessionFactory
from tests.unit.graphql import AsyncGraphQLClient


async def _seed_agent_session(
    db: DbSessionFactory,
    *,
    session_id: str,
    title: str,
    updated_at: datetime,
) -> None:
    async with db() as session:
        session.add(
            models.AgentSession(
                session_id=session_id,
                user_id=None,
                title=title,
                messages=[],
                created_at=updated_at,
                updated_at=updated_at,
            )
        )


_LIST_QUERY = """
  query ($first: Int, $after: String) {
    agentSessions(first: $first, after: $after) {
      edges {
        cursor
        node { sessionId title }
      }
      pageInfo { hasNextPage }
    }
  }
"""


async def test_agent_sessions_orders_by_recency_and_paginates(
    db: DbSessionFactory,
    gql_client: AsyncGraphQLClient,
) -> None:
    for index, session_id in enumerate(("oldest", "middle", "newest")):
        await _seed_agent_session(
            db,
            session_id=session_id,
            title=f"{session_id} session",
            updated_at=datetime(2026, 1, 1 + index, tzinfo=timezone.utc),
        )

    response = await gql_client.execute(query=_LIST_QUERY, variables={"first": 2})
    assert not response.errors
    assert response.data is not None
    connection = response.data["agentSessions"]
    assert [edge["node"]["sessionId"] for edge in connection["edges"]] == ["newest", "middle"]
    assert connection["pageInfo"]["hasNextPage"] is True

    next_page = await gql_client.execute(
        query=_LIST_QUERY,
        variables={"first": 2, "after": connection["edges"][-1]["cursor"]},
    )
    assert not next_page.errors
    assert next_page.data is not None
    connection = next_page.data["agentSessions"]
    assert [edge["node"]["sessionId"] for edge in connection["edges"]] == ["oldest"]
    assert connection["pageInfo"]["hasNextPage"] is False

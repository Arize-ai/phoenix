from datetime import datetime, timezone
from typing import Any

from phoenix.db import models
from phoenix.server.types import DbSessionFactory
from tests.unit.graphql import AsyncGraphQLClient


async def _seed_agent_session(
    db: DbSessionFactory,
    *,
    session_uuid: str,
    title: str,
    updated_at: datetime,
    snapshots: list[list[dict[str, Any]]] = [],
) -> None:
    async with db() as session:
        agent_session = models.AgentSession(
            session_uuid=session_uuid,
            user_id=None,
            title=title,
            created_at=updated_at,
            updated_at=updated_at,
        )
        session.add(agent_session)
        await session.flush()
        for messages in snapshots:
            session.add(
                models.AgentSessionSnapshot(
                    agent_session_id=agent_session.id,
                    messages=messages,
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
    for index, session_uuid in enumerate(("oldest", "middle", "newest")):
        await _seed_agent_session(
            db,
            session_uuid=session_uuid,
            title=f"{session_uuid} session",
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

from datetime import datetime, timezone
from typing import Any

from phoenix.db import models
from phoenix.db.types.data_stream_protocol import PhoenixUIMessage
from phoenix.server.types import DbSessionFactory
from tests.unit.graphql import AsyncGraphQLClient


async def _seed_agent_session(
    db: DbSessionFactory,
    *,
    session_id: str,
    title: str,
    updated_at: datetime,
    messages: list[dict[str, Any]] | None = None,
) -> None:
    async with db() as session:
        agent_session = models.AgentSession(
            session_id=session_id,
            user_id=None,
            title=title,
            created_at=updated_at,
            updated_at=updated_at,
        )
        session.add(agent_session)
        await session.flush()
        session.add_all(
            models.AgentSessionMessage(
                agent_session_id=agent_session.id,
                position=position,
                message=PhoenixUIMessage.model_validate(message),
            )
            for position, message in enumerate(messages or [])
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

_DETAIL_QUERY = """
  query ($sessionId: String!) {
    agentSession(sessionId: $sessionId) {
      sessionId
      title
      messages
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


async def test_agent_session_loads_transcript_by_session_id(
    db: DbSessionFactory,
    gql_client: AsyncGraphQLClient,
) -> None:
    messages = [{"id": "message-1", "role": "user", "parts": []}]
    await _seed_agent_session(
        db,
        session_id="session-1",
        title="Session one",
        updated_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
        messages=messages,
    )

    response = await gql_client.execute(
        query=_DETAIL_QUERY,
        variables={"sessionId": "session-1"},
    )

    assert not response.errors
    assert response.data == {
        "agentSession": {
            "sessionId": "session-1",
            "title": "Session one",
            "messages": messages,
        }
    }


async def test_agent_session_returns_null_when_missing(
    gql_client: AsyncGraphQLClient,
) -> None:
    response = await gql_client.execute(
        query=_DETAIL_QUERY,
        variables={"sessionId": "missing"},
    )

    assert not response.errors
    assert response.data == {"agentSession": None}

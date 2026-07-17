from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.db.types.data_stream_protocol import PhoenixUIMessage
from phoenix.server.agents.session_persistence import make_agent_session_message_row
from phoenix.server.types import DbSessionFactory
from tests.unit.graphql import AsyncGraphQLClient


async def _seed_agent_session(
    db: DbSessionFactory,
    *,
    title: str,
    updated_at: datetime,
    messages: list[dict[str, Any]] | None = None,
) -> str:
    async with db() as session:
        agent_session = models.AgentSession(
            project_session_id=str(uuid4()),
            user_id=None,
            title=title,
            project_name="assistant_agent",
            created_at=updated_at,
            updated_at=updated_at,
        )
        session.add(agent_session)
        await session.flush()
        session.add_all(
            make_agent_session_message_row(
                agent_session_rowid=agent_session.id,
                position=position,
                message=PhoenixUIMessage.model_validate(message),
            )
            for position, message in enumerate(messages or [])
        )
        return str(GlobalID("AgentSession", str(agent_session.id)))


_LIST_QUERY = """
  query ($first: Int, $after: String) {
    agentSessions(first: $first, after: $after) {
      edges {
        cursor
        node { id title }
      }
      pageInfo { hasNextPage }
    }
  }
"""

_DETAIL_QUERY = """
  query ($id: ID!) {
    agentSession: node(id: $id) {
      ... on AgentSession {
        id
        title
        messages
      }
    }
  }
"""


async def test_agent_sessions_orders_by_recency_and_paginates(
    db: DbSessionFactory,
    gql_client: AsyncGraphQLClient,
) -> None:
    for index, title in enumerate(("oldest", "middle", "newest")):
        await _seed_agent_session(
            db,
            title=f"{title} session",
            updated_at=datetime(2026, 1, 1 + index, tzinfo=timezone.utc),
        )

    response = await gql_client.execute(query=_LIST_QUERY, variables={"first": 2})
    assert not response.errors
    assert response.data is not None
    connection = response.data["agentSessions"]
    assert [edge["node"]["title"] for edge in connection["edges"]] == [
        "newest session",
        "middle session",
    ]
    assert connection["pageInfo"]["hasNextPage"] is True

    next_page = await gql_client.execute(
        query=_LIST_QUERY,
        variables={"first": 2, "after": connection["edges"][-1]["cursor"]},
    )
    assert not next_page.errors
    assert next_page.data is not None
    connection = next_page.data["agentSessions"]
    assert [edge["node"]["title"] for edge in connection["edges"]] == ["oldest session"]
    assert connection["pageInfo"]["hasNextPage"] is False


async def test_agent_session_loads_transcript_by_id(
    db: DbSessionFactory,
    gql_client: AsyncGraphQLClient,
) -> None:
    messages = [{"id": "message-1", "role": "user", "parts": []}]
    agent_session_id = await _seed_agent_session(
        db,
        title="Session one",
        updated_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
        messages=messages,
    )

    response = await gql_client.execute(
        query=_DETAIL_QUERY,
        variables={"id": agent_session_id},
    )

    assert not response.errors
    assert response.data == {
        "agentSession": {
            "id": agent_session_id,
            "title": "Session one",
            "messages": messages,
        }
    }


async def test_agent_session_node_returns_not_found_when_missing(
    gql_client: AsyncGraphQLClient,
) -> None:
    agent_session_id = str(GlobalID("AgentSession", "999999"))
    response = await gql_client.execute(
        query=_DETAIL_QUERY,
        variables={"id": agent_session_id},
    )

    assert response.data is None
    assert response.errors
    assert response.errors[0].message == f"Unknown agent session: {agent_session_id}"

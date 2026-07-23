from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import uuid4

from sqlalchemy import select
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.db.types.data_stream_protocol import PhoenixUIMessage
from phoenix.server.types import DbSessionFactory
from tests.unit.graphql import AsyncGraphQLClient


async def _seed_agent_session(
    db: DbSessionFactory,
    *,
    title: str,
    updated_at: datetime,
    messages: list[dict[str, Any]] | None = None,
    expires_at: datetime | None = None,
    user_id: int | None = None,
) -> str:
    async with db() as session:
        agent_session = models.AgentSession(
            project_session_id=str(uuid4()),
            user_id=user_id,
            title=title,
            project_name="assistant_agent",
            created_at=updated_at,
            updated_at=updated_at,
            expires_at=expires_at,
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
        user { username profilePictureUrl }
        firstInput
        latestOutput
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


async def test_agent_sessions_excludes_temporary_sessions(
    db: DbSessionFactory,
    gql_client: AsyncGraphQLClient,
) -> None:
    now = datetime.now(timezone.utc)
    persistent_id = await _seed_agent_session(
        db,
        title="persistent",
        updated_at=now,
    )
    temporary_id = await _seed_agent_session(
        db,
        title="temporary",
        updated_at=now,
        expires_at=now + timedelta(days=1),
    )

    response = await gql_client.execute(query=_LIST_QUERY)

    assert not response.errors
    assert response.data is not None
    assert [edge["node"]["id"] for edge in response.data["agentSessions"]["edges"]] == [
        persistent_id
    ]

    detail_response = await gql_client.execute(
        query=_DETAIL_QUERY,
        variables={"id": temporary_id},
    )
    assert not detail_response.errors
    assert detail_response.data is not None
    assert detail_response.data["agentSession"]["id"] == temporary_id


async def test_agent_session_loads_transcript_by_id(
    db: DbSessionFactory,
    gql_client: AsyncGraphQLClient,
) -> None:
    async with db() as session:
        user_role_id = await session.scalar(
            select(models.UserRole.id).where(models.UserRole.name == "MEMBER")
        )
        assert user_role_id is not None
        user = models.User(
            user_role_id=user_role_id,
            username="session-author",
            email="session-author@example.com",
            password_hash=b"hash",
            password_salt=b"salt",
            reset_password=False,
            auth_method="LOCAL",
        )
        session.add(user)
        await session.flush()
        user_id = user.id
    messages: list[dict[str, Any]] = [
        {
            "id": "message-1",
            "role": "user",
            "parts": [{"type": "text", "text": "First question"}],
        },
        {
            "id": "message-2",
            "role": "assistant",
            "parts": [{"type": "text", "text": "Earlier answer"}],
        },
        {
            "id": "compaction-1",
            "role": "user",
            "metadata": {
                "type": "user",
                "currentDateTime": "2026-01-01T00:00:00Z",
                "timeZone": "UTC",
                "isCompactionMessage": True,
            },
            "parts": [{"type": "text", "text": '{"objectives":["test"]}'}],
        },
        {
            "id": "message-3",
            "role": "assistant",
            "parts": [
                {"type": "text", "text": "Latest"},
                {"type": "text", "text": "answer"},
            ],
        },
    ]
    agent_session_id = await _seed_agent_session(
        db,
        title="Session one",
        updated_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
        messages=messages,
        user_id=user_id,
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
            "user": {
                "username": "session-author",
                "profilePictureUrl": None,
            },
            "firstInput": "First question",
            "latestOutput": "Latest\nanswer",
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


async def test_agent_session_node_returns_not_found_when_expired(
    db: DbSessionFactory,
    gql_client: AsyncGraphQLClient,
) -> None:
    # A temporary session whose deadline has already passed reads as gone even
    # though the sweeper has not yet deleted its row.
    now = datetime.now(timezone.utc)
    agent_session_id = await _seed_agent_session(
        db,
        title="expired",
        updated_at=now - timedelta(days=2),
        expires_at=now - timedelta(seconds=1),
    )

    response = await gql_client.execute(
        query=_DETAIL_QUERY,
        variables={"id": agent_session_id},
    )

    assert response.data is None
    assert response.errors
    assert response.errors[0].message == f"Unknown agent session: {agent_session_id}"

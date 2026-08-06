from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import select
from strawberry.relay import GlobalID

from phoenix.config import EPHEMERAL_AGENT_SESSION_TIME_TO_LIVE_HOURS
from phoenix.db import models
from phoenix.db.types.data_stream_protocol import PhoenixUIMessage
from phoenix.db.types.model_provider import ModelProvider
from phoenix.server.encryption import EncryptionService
from phoenix.server.types import DbSessionFactory
from tests.unit._helpers import _agent_session_model_kwargs, _message_uuid
from tests.unit.graphql import AsyncGraphQLClient


async def _seed_agent_session(
    db: DbSessionFactory,
    *,
    title: str,
    updated_at: datetime,
    messages: list[dict[str, Any]] | None = None,
    is_ephemeral: bool = False,
    user_id: int | None = None,
    heartbeat_at: datetime | None = None,
) -> str:
    async with db() as session:
        agent_session = models.AgentSession(
            **_agent_session_model_kwargs(),
            user_id=user_id,
            title=title,
            project_name="assistant_agent",
            created_at=updated_at,
            updated_at=updated_at,
            is_ephemeral=is_ephemeral,
            heartbeat_at=heartbeat_at,
        )
        session.add(agent_session)
        await session.flush()
        session.add_all(
            models.AgentSessionMessage(
                agent_session_id=agent_session.id,
                message=PhoenixUIMessage.model_validate(message),
            )
            for message in messages or []
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
        lastMessageId
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


async def test_agent_session_is_active_reflects_heartbeat_liveness(
    db: DbSessionFactory,
    gql_client: AsyncGraphQLClient,
) -> None:
    """``isActive`` derives from the session lock heartbeat with the same
    staleness window the REST claim uses: live within 60s, free otherwise."""
    now = datetime.now(timezone.utc)
    query = """
      query ($id: ID!) {
        agentSession: node(id: $id) {
          ... on AgentSession { isActive }
        }
      }
    """
    expectations = {
        "unlocked": (None, False),
        "streaming": (now - timedelta(seconds=5), True),
        "abandoned": (now - timedelta(seconds=120), False),
    }
    for title, (heartbeat_at, expected) in expectations.items():
        session_id = await _seed_agent_session(
            db,
            title=title,
            updated_at=now,
            heartbeat_at=heartbeat_at,
        )
        response = await gql_client.execute(query=query, variables={"id": session_id})
        assert not response.errors
        assert response.data is not None
        assert response.data["agentSession"]["isActive"] is expected, title


async def test_agent_session_serializes_deleted_custom_provider_as_builtin_fallback(
    db: DbSessionFactory,
    gql_client: AsyncGraphQLClient,
) -> None:
    async with db() as session:
        provider = models.GenerativeModelCustomProvider(
            name="Deleted custom provider",
            provider="openai",
            sdk="openai",
            config=EncryptionService().encrypt(b"{}"),
        )
        session.add(provider)
        await session.flush()
        agent_session = models.AgentSession(
            user_id=None,
            title="Orphaned provider",
            project_name="assistant_agent",
            model_provider=ModelProvider.OPENAI,
            model_name="custom-model",
            custom_provider_id=provider.id,
        )
        session.add(agent_session)
        await session.flush()
        agent_session_id = str(GlobalID("AgentSession", str(agent_session.id)))

    async with db() as session:
        deleted_provider = await session.scalar(
            select(models.GenerativeModelCustomProvider).where(
                models.GenerativeModelCustomProvider.name == "Deleted custom provider"
            )
        )
        assert deleted_provider is not None
        await session.delete(deleted_provider)

    response = await gql_client.execute(
        query="""
          query ($id: ID!) {
            agentSession: node(id: $id) {
              ... on AgentSession {
                model {
                  __typename
                  ... on AgentBuiltinProviderModelSelection {
                    provider
                    modelName
                  }
                }
              }
            }
          }
        """,
        variables={"id": agent_session_id},
    )

    assert not response.errors
    assert response.data == {
        "agentSession": {
            "model": {
                "__typename": "AgentBuiltinProviderModelSelection",
                "provider": "OPENAI",
                "modelName": "custom-model",
            },
        }
    }


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
        is_ephemeral=True,
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
            "id": _message_uuid("message-1"),
            "role": "user",
            "parts": [{"type": "text", "text": "First question"}],
        },
        {
            "id": _message_uuid("message-2"),
            "role": "assistant",
            "parts": [{"type": "text", "text": "Earlier answer"}],
        },
        {
            "id": _message_uuid("compaction-1"),
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
            "id": _message_uuid("message-3"),
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
            "lastMessageId": _message_uuid("message-3"),
            "messages": messages,
        }
    }


async def test_agent_session_last_message_id_is_null_for_empty_transcript(
    db: DbSessionFactory,
    gql_client: AsyncGraphQLClient,
) -> None:
    agent_session_id = await _seed_agent_session(
        db,
        title="Empty session",
        updated_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
    )

    response = await gql_client.execute(
        query="""
          query ($id: ID!) {
            agentSession: node(id: $id) {
              ... on AgentSession { lastMessageId }
            }
          }
        """,
        variables={"id": agent_session_id},
    )

    assert not response.errors
    assert response.data == {"agentSession": {"lastMessageId": None}}


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


async def test_agent_session_node_resolves_while_the_sweeper_has_not_reached_it(
    db: DbSessionFactory,
    gql_client: AsyncGraphQLClient,
) -> None:
    agent_session_id = await _seed_agent_session(
        db,
        title="idle past its ttl",
        updated_at=datetime.now(timezone.utc)
        - timedelta(hours=EPHEMERAL_AGENT_SESSION_TIME_TO_LIVE_HOURS + 1),
        is_ephemeral=True,
    )

    response = await gql_client.execute(
        query=_DETAIL_QUERY,
        variables={"id": agent_session_id},
    )

    assert not response.errors
    assert response.data is not None
    assert response.data["agentSession"]["id"] == agent_session_id

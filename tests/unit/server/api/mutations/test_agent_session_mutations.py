from datetime import datetime, timezone
from typing import Literal, cast
from uuid import UUID

import pytest
from fastapi import FastAPI
from sqlalchemy import select
from strawberry.relay import GlobalID

from phoenix.config import get_env_phoenix_agents_assistant_project_name
from phoenix.db import models
from phoenix.db.types.data_stream_protocol import PhoenixUIMessage
from phoenix.server.api.context import Context
from phoenix.server.bearer_auth import PhoenixUser
from phoenix.server.settings.registry import AgentAssistantEnabledSetting
from phoenix.server.types import (
    AccessTokenId,
    DbSessionFactory,
    UserClaimSet,
    UserId,
    UserTokenAttributes,
)
from tests.unit.graphql import AsyncGraphQLClient

_DELETE_MUTATION = """
  mutation ($id: ID!) {
    deleteAgentSession(input: { id: $id }) {
      deletedAgentSessionId
    }
  }
"""

_CREATE_MUTATION = """
  mutation {
    createAgentSession {
      agentSession {
        id
        title
        createdAt
        updatedAt
        messages
      }
    }
  }
"""

_CREATE_ID_ONLY_MUTATION = """
  mutation {
    createAgentSession {
      agentSession { id }
    }
  }
"""

_TRUNCATE_MUTATION = """
  mutation ($id: ID!, $lastMessageId: String) {
    truncateAgentSession(input: { id: $id, lastMessageId: $lastMessageId }) {
      agentSession {
        id
        messages
      }
    }
  }
"""

_FORK_MUTATION = """
  mutation ($sourceSessionId: ID!, $lastMessageId: String) {
    forkAgentSession(
      input: {
        sourceSessionId: $sourceSessionId
        lastMessageId: $lastMessageId
      }
    ) {
      agentSession {
        id
        title
        messages
      }
    }
  }
"""


async def _create_session_with_transcript(db: DbSessionFactory) -> tuple[int, str]:
    async with db() as session:
        agent_session = models.AgentSession(
            project_session_id="11111111-1111-4111-8111-111111111111",
            project_name="assistant_agent",
            user_id=None,
            title="Original",
        )
        session.add(agent_session)
        await session.flush()
        messages = [
            PhoenixUIMessage(id="user-1", role="user", parts=[]),
            PhoenixUIMessage(id="assistant-1", role="assistant", parts=[]),
            PhoenixUIMessage(id="user-2", role="user", parts=[]),
            PhoenixUIMessage(id="assistant-2", role="assistant", parts=[]),
        ]
        session.add_all(
            models.AgentSessionMessage(
                agent_session_id=agent_session.id,
                position=position,
                message=message,
            )
            for position, message in enumerate(messages)
        )
        session.add(
            models.AgentSessionSnapshot(
                agent_session_id=agent_session.id,
                bashkit_snapshot=b"shell-state",
            )
        )
        return agent_session.id, str(GlobalID("AgentSession", str(agent_session.id)))


async def _create_phoenix_user(
    db: DbSessionFactory,
    *,
    role: Literal["MEMBER", "VIEWER"],
    username: str,
) -> PhoenixUser:
    async with db() as session:
        role_id = await session.scalar(
            select(models.UserRole.id).where(models.UserRole.name == role)
        )
        if role_id is None:
            user_role = models.UserRole(name=role)
            session.add(user_role)
            await session.flush()
            role_id = user_role.id
        user = models.User(
            user_role_id=role_id,
            username=username,
            email=f"{username}@example.com",
            profile_picture_url=None,
            password_hash=b"password-hash",
            password_salt=b"password-salt",
            reset_password=False,
            oauth2_client_id=None,
            oauth2_user_id=None,
            ldap_unique_id=None,
            auth_method="LOCAL",
        )
        session.add(user)
        await session.flush()
        user_id = UserId(user.id)
    return PhoenixUser(
        user_id,
        UserClaimSet(
            subject=user_id,
            token_id=AccessTokenId(user.id),
            attributes=UserTokenAttributes(user_role=role),
        ),
    )


def _authenticated_context(app: FastAPI, user: PhoenixUser) -> Context:
    context = cast(Context, app.state.build_graphql_context(user))
    context.auth_enabled = True
    return context


async def test_create_agent_session_returns_canonical_empty_node(
    db: DbSessionFactory,
    gql_client: AsyncGraphQLClient,
) -> None:
    response = await gql_client.execute(query=_CREATE_MUTATION)

    assert response.data and not response.errors
    node = response.data["createAgentSession"]["agentSession"]
    assert node["title"] == ""
    assert node["messages"] == []
    global_id = GlobalID.from_id(node["id"])
    assert global_id.type_name == models.AgentSession.__name__
    async with db() as session:
        agent_session = await session.get(models.AgentSession, int(global_id.node_id))
        assert agent_session is not None
        assert agent_session.user_id is None
        assert agent_session.project_name == get_env_phoenix_agents_assistant_project_name()
        assert UUID(agent_session.project_session_id).version == 4
        assert agent_session.created_at.isoformat() == node["createdAt"]
        assert agent_session.updated_at.isoformat() == node["updatedAt"]


async def test_create_agent_session_is_blocked_when_storage_is_locked(
    db: DbSessionFactory,
    gql_client: AsyncGraphQLClient,
) -> None:
    db.should_not_insert_or_update = True
    try:
        response = await gql_client.execute(query=_CREATE_MUTATION)
    finally:
        db.should_not_insert_or_update = False

    assert response.errors
    assert "disabled due to insufficient storage" in response.errors[0].message
    async with db() as session:
        assert (await session.scalars(select(models.AgentSession))).all() == []


async def test_create_agent_session_is_blocked_when_assistant_is_disabled(
    app: FastAPI,
    db: DbSessionFactory,
    gql_client: AsyncGraphQLClient,
) -> None:
    settings = app.state.system_settings
    await settings.update_agent_assistant_enabled(AgentAssistantEnabledSetting(enabled=False))
    try:
        response = await gql_client.execute(query=_CREATE_ID_ONLY_MUTATION)
    finally:
        await settings.update_agent_assistant_enabled(AgentAssistantEnabledSetting(enabled=True))

    assert response.errors
    assert response.errors[0].message == "Agents are disabled"
    async with db() as session:
        assert (await session.scalars(select(models.AgentSession))).all() == []


@pytest.mark.parametrize("role", ["MEMBER", "VIEWER"])
async def test_authenticated_users_can_create_owned_agent_sessions(
    role: Literal["MEMBER", "VIEWER"],
    app: FastAPI,
    db: DbSessionFactory,
) -> None:
    user = await _create_phoenix_user(db, role=role, username=f"session-{role.lower()}")

    response = await app.state.graphql_schema.execute(
        _CREATE_MUTATION,
        context_value=_authenticated_context(app, user),
    )

    assert response.data and not response.errors
    global_id = GlobalID.from_id(response.data["createAgentSession"]["agentSession"]["id"])
    async with db() as session:
        agent_session = await session.get(models.AgentSession, int(global_id.node_id))
        assert agent_session is not None
        assert agent_session.user_id == int(user.identity)


async def test_agent_session_node_rejects_another_authenticated_owner(
    app: FastAPI,
    db: DbSessionFactory,
) -> None:
    owner = await _create_phoenix_user(db, role="MEMBER", username="session-owner")
    other_user = await _create_phoenix_user(db, role="MEMBER", username="session-other")
    create_response = await app.state.graphql_schema.execute(
        _CREATE_MUTATION,
        context_value=_authenticated_context(app, owner),
    )
    assert create_response.data and not create_response.errors
    agent_session_id = create_response.data["createAgentSession"]["agentSession"]["id"]

    response = await app.state.graphql_schema.execute(
        """
        query ($id: ID!) {
          node(id: $id) {
            ... on AgentSession { title }
          }
        }
        """,
        variable_values={"id": agent_session_id},
        context_value=_authenticated_context(app, other_user),
    )

    assert response.errors
    assert "Unknown agent session" in response.errors[0].message


async def test_delete_agent_session_cascades_snapshot(
    db: DbSessionFactory,
    gql_client: AsyncGraphQLClient,
) -> None:
    now = datetime(2026, 1, 1, tzinfo=timezone.utc)
    async with db() as session:
        agent_session = models.AgentSession(
            project_session_id="11111111-1111-4111-8111-111111111111",
            user_id=None,
            title="doomed session",
            project_name="assistant_agent",
            created_at=now,
            updated_at=now,
        )
        session.add(agent_session)
        await session.flush()
        agent_session_id = str(GlobalID("AgentSession", str(agent_session.id)))
        session.add(
            models.AgentSessionSnapshot(
                agent_session_id=agent_session.id,
                bashkit_snapshot=b"shell-state",
            )
        )
        session.add(
            models.AgentSessionMessage(
                agent_session_id=agent_session.id,
                position=0,
                message=PhoenixUIMessage(id="m1", role="user", parts=[]),
            )
        )

    response = await gql_client.execute(
        query=_DELETE_MUTATION,
        variables={"id": agent_session_id},
    )
    assert not response.errors
    assert response.data is not None
    assert response.data["deleteAgentSession"]["deletedAgentSessionId"]
    async with db() as session:
        assert (await session.scalars(select(models.AgentSession))).all() == []
        assert (await session.scalars(select(models.AgentSessionSnapshot))).all() == []
        assert (await session.scalars(select(models.AgentSessionMessage))).all() == []


async def test_delete_agent_session_not_found(
    gql_client: AsyncGraphQLClient,
) -> None:
    response = await gql_client.execute(
        query=_DELETE_MUTATION,
        variables={"id": str(GlobalID("AgentSession", "999999"))},
    )
    assert response.errors
    assert "No agent session found" in response.errors[0].message


async def test_truncate_agent_session_persists_prefix_and_deletes_snapshot(
    db: DbSessionFactory,
    gql_client: AsyncGraphQLClient,
) -> None:
    agent_session_rowid, agent_session_id = await _create_session_with_transcript(db)

    response = await gql_client.execute(
        query=_TRUNCATE_MUTATION,
        variables={"id": agent_session_id, "lastMessageId": "assistant-1"},
    )

    assert response.data and not response.errors
    messages = response.data["truncateAgentSession"]["agentSession"]["messages"]
    assert [message["id"] for message in messages] == ["user-1", "assistant-1"]
    async with db() as session:
        stored_messages = list(
            await session.scalars(
                select(models.AgentSessionMessage)
                .where(models.AgentSessionMessage.agent_session_id == agent_session_rowid)
                .order_by(models.AgentSessionMessage.position)
            )
        )
        assert [message.message.id for message in stored_messages] == [
            "user-1",
            "assistant-1",
        ]
        assert await session.scalar(select(models.AgentSessionSnapshot)) is None


async def test_truncate_agent_session_to_empty_transcript(
    db: DbSessionFactory,
    gql_client: AsyncGraphQLClient,
) -> None:
    _, agent_session_id = await _create_session_with_transcript(db)

    response = await gql_client.execute(
        query=_TRUNCATE_MUTATION,
        variables={"id": agent_session_id, "lastMessageId": None},
    )

    assert response.data and not response.errors
    assert response.data["truncateAgentSession"]["agentSession"]["messages"] == []


async def test_fork_agent_session_copies_prefix_without_snapshot(
    db: DbSessionFactory,
    gql_client: AsyncGraphQLClient,
) -> None:
    source_session_rowid, source_session_id = await _create_session_with_transcript(db)

    response = await gql_client.execute(
        query=_FORK_MUTATION,
        variables={
            "sourceSessionId": source_session_id,
            "lastMessageId": "assistant-1",
        },
    )

    assert response.data and not response.errors
    forked_session = response.data["forkAgentSession"]["agentSession"]
    assert forked_session["title"] == "(branch) Original"
    assert [message["id"] for message in forked_session["messages"]] == [
        "user-1",
        "assistant-1",
    ]
    forked_session_rowid = int(GlobalID.from_id(forked_session["id"]).node_id)
    async with db() as session:
        source_message_count = len(
            list(
                await session.scalars(
                    select(models.AgentSessionMessage).where(
                        models.AgentSessionMessage.agent_session_id == source_session_rowid
                    )
                )
            )
        )
        assert source_message_count == 4
        assert (
            await session.scalar(
                select(models.AgentSessionSnapshot).where(
                    models.AgentSessionSnapshot.agent_session_id == forked_session_rowid
                )
            )
            is None
        )

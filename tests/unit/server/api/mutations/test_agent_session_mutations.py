from datetime import datetime, timedelta, timezone
from typing import Iterator
from uuid import UUID

import pytest
from fastapi import FastAPI
from sqlalchemy import func, select
from strawberry.relay import GlobalID

from phoenix.config import EPHEMERAL_AGENT_SESSION_TIME_TO_LIVE_HOURS
from phoenix.db import models
from phoenix.db.types.data_stream_protocol import (
    PhoenixUIMessage,
    TextUIPart,
)
from phoenix.server.agents.session_titles import MAX_AGENT_SESSION_TITLE_LENGTH
from phoenix.server.api.helpers.agent_sessions import TURN_LOCK_STALENESS, get_otel_session_id
from phoenix.server.api.routers.agents import (
    _build_compaction_message,
    _load_agent_session_history,
)
from phoenix.server.authorization import insufficient_storage_message
from phoenix.server.settings.registry import AgentAssistantEnabledSetting
from phoenix.server.types import DbSessionFactory
from tests.unit._helpers import _agent_session_model_kwargs, _message_uuid
from tests.unit.graphql import AsyncGraphQLClient

_CREATE_MUTATION = """
  mutation ($title: String!) {
    createAgentSession(
      input: {
        title: $title
        model: { builtin: { provider: OPENAI, modelName: "gpt-test" } }
      }
    ) {
      agentSession {
        id
        title
        isEphemeral
        model {
          __typename
          ... on AgentBuiltinProviderModelSelection {
            provider
            modelName
            openaiApiType
          }
        }
        messages
      }
    }
  }
"""

_TRUNCATE_MUTATION = """
  mutation ($id: ID!, $messageId: String!) {
    truncateAgentSession(input: { id: $id, messageId: $messageId }) {
      agentSession {
        id
        messages
      }
    }
  }
"""

_BRANCH_MUTATION = """
  mutation ($id: ID!, $messageId: String!) {
    branchAgentSession(input: { id: $id, messageId: $messageId }) {
      agentSession {
        id
        title
        isEphemeral
        model {
          __typename
          ... on AgentBuiltinProviderModelSelection {
            provider
            modelName
            openaiApiType
          }
        }
        messages
      }
    }
  }
"""

_DELETE_MUTATION = """
  mutation ($id: ID!) {
    deleteAgentSession(input: { id: $id }) {
      deletedAgentSessionId
    }
  }
"""

_UPDATE_TITLE_MUTATION = """
  mutation ($id: ID!, $title: String!) {
    updateAgentSessionTitle(input: { id: $id, title: $title }) {
      agentSession {
        id
        title
      }
    }
  }
"""

_UPDATE_MODEL_MUTATION = """
  mutation ($id: ID!, $model: AgentModelSelectionInput!) {
    updateAgentSessionModel(input: { id: $id, model: $model }) {
      agentSession {
        id
        model {
          __typename
          ... on AgentBuiltinProviderModelSelection {
            provider
            modelName
          }
          ... on AgentCustomProviderModelSelection {
            providerId
            modelName
          }
        }
      }
    }
  }
"""


@pytest.mark.parametrize(
    ("mutation", "variables"),
    [
        (_CREATE_MUTATION, {"title": ""}),
        (
            _TRUNCATE_MUTATION,
            {
                "id": str(GlobalID("AgentSession", "1")),
                "messageId": "message-1",
            },
        ),
        (
            _BRANCH_MUTATION,
            {
                "id": str(GlobalID("AgentSession", "1")),
                "messageId": "message-1",
            },
        ),
    ],
    ids=("create", "truncate", "branch"),
)
async def test_agent_session_mutation_requires_enabled_agent_assistant(
    app: FastAPI,
    gql_client: AsyncGraphQLClient,
    mutation: str,
    variables: dict[str, str],
) -> None:
    await app.state.system_settings.update_agent_assistant_enabled(
        AgentAssistantEnabledSetting(enabled=False)
    )

    response = await gql_client.execute(query=mutation, variables=variables)

    assert response.errors
    assert response.errors[0].message == "Agents are disabled"


def _transcript_messages() -> list[PhoenixUIMessage]:
    """A two-turn transcript."""
    return [
        PhoenixUIMessage(
            id=_message_uuid("user-1"),
            role="user",
            parts=[TextUIPart(text="How do I trace OpenAI?")],
        ),
        PhoenixUIMessage(
            id=_message_uuid("assistant-1"),
            role="assistant",
            parts=[TextUIPart(text="Use register().")],
        ),
        PhoenixUIMessage(
            id=_message_uuid("user-2"),
            role="user",
            parts=[TextUIPart(text="Show "), TextUIPart(text="an example")],
        ),
        PhoenixUIMessage(
            id=_message_uuid("assistant-2"),
            role="assistant",
            parts=[TextUIPart(text="Here is an example.")],
        ),
    ]


async def _seed_session_with_transcript(
    db: DbSessionFactory,
    *,
    title: str = "",
    is_ephemeral: bool = False,
    updated_at: datetime | None = None,
    heartbeat_at: datetime | None = None,
) -> str:
    async with db() as session:
        agent_session = models.AgentSession(
            **_agent_session_model_kwargs(),
            user_id=None,
            title=title,
            project_name="assistant_agent",
            is_ephemeral=is_ephemeral,
            heartbeat_at=heartbeat_at,
        )
        if updated_at is not None:
            agent_session.created_at = agent_session.updated_at = updated_at
        session.add(agent_session)
        await session.flush()
        session.add_all(
            models.AgentSessionMessage(
                agent_session_id=agent_session.id,
                message=message,
            )
            for message in _transcript_messages()
        )
        return str(GlobalID("AgentSession", str(agent_session.id)))


@pytest.mark.parametrize(
    ("mutation", "message_id"),
    [
        (_TRUNCATE_MUTATION, _message_uuid("user-2")),
        (_BRANCH_MUTATION, _message_uuid("assistant-1")),
        (_DELETE_MUTATION, None),
    ],
    ids=("truncate", "branch", "delete"),
)
async def test_session_history_mutations_reject_an_active_turn(
    db: DbSessionFactory,
    gql_client: AsyncGraphQLClient,
    mutation: str,
    message_id: str | None,
) -> None:
    agent_session_id = await _seed_session_with_transcript(
        db,
        heartbeat_at=datetime.now(timezone.utc),
    )
    variables = {"id": agent_session_id}
    if message_id is not None:
        variables["messageId"] = message_id

    response = await gql_client.execute(query=mutation, variables=variables)

    assert response.errors
    assert response.errors[0].message == (
        "This session is busy. "
        "Wait for the current operation to finish before modifying the conversation."
    )
    async with db() as session:
        assert await session.scalar(select(func.count()).select_from(models.AgentSession)) == 1
        assert await session.scalar(
            select(func.count()).select_from(models.AgentSessionMessage)
        ) == len(_transcript_messages())


@pytest.mark.parametrize(
    ("mutation", "message_id"),
    [
        (_TRUNCATE_MUTATION, _message_uuid("user-2")),
        (_BRANCH_MUTATION, _message_uuid("assistant-1")),
        (_DELETE_MUTATION, None),
    ],
    ids=("truncate", "branch", "delete"),
)
async def test_session_history_mutations_accept_a_stale_turn_lock(
    db: DbSessionFactory,
    gql_client: AsyncGraphQLClient,
    mutation: str,
    message_id: str | None,
) -> None:
    agent_session_id = await _seed_session_with_transcript(
        db,
        heartbeat_at=datetime.now(timezone.utc) - TURN_LOCK_STALENESS - timedelta(seconds=1),
    )
    variables = {"id": agent_session_id}
    if message_id is not None:
        variables["messageId"] = message_id

    response = await gql_client.execute(query=mutation, variables=variables)

    assert not response.errors


async def test_truncate_agent_session_at_a_user_message_removes_it_and_later_turns(
    db: DbSessionFactory,
    gql_client: AsyncGraphQLClient,
) -> None:
    agent_session_id = await _seed_session_with_transcript(db)
    async with db() as session:
        retained_message_rowids = list(
            await session.scalars(
                select(models.AgentSessionMessage.id)
                .order_by(models.AgentSessionMessage.id)
                .limit(2)
            )
        )

    response = await gql_client.execute(
        query=_TRUNCATE_MUTATION,
        variables={"id": agent_session_id, "messageId": _message_uuid("user-2")},
    )
    assert not response.errors
    assert response.data is not None
    payload = response.data["truncateAgentSession"]
    # The user target and everything after it are removed.
    assert [message["id"] for message in payload["agentSession"]["messages"]] == [
        _message_uuid("user-1"),
        _message_uuid("assistant-1"),
    ]
    async with db() as session:
        stored_message_rows = (
            await session.scalars(
                select(models.AgentSessionMessage).order_by(models.AgentSessionMessage.id)
            )
        ).all()
    assert [row.message.id for row in stored_message_rows] == [
        _message_uuid("user-1"),
        _message_uuid("assistant-1"),
    ]
    assert [row.message_id for row in stored_message_rows] == [
        _message_uuid("user-1"),
        _message_uuid("assistant-1"),
    ]
    assert [row.id for row in stored_message_rows] == retained_message_rowids


async def test_truncate_agent_session_at_an_assistant_message_retains_it(
    db: DbSessionFactory,
    gql_client: AsyncGraphQLClient,
) -> None:
    agent_session_id = await _seed_session_with_transcript(db)

    response = await gql_client.execute(
        query=_TRUNCATE_MUTATION,
        variables={"id": agent_session_id, "messageId": _message_uuid("assistant-2")},
    )
    assert not response.errors
    assert response.data is not None
    payload = response.data["truncateAgentSession"]
    messages = payload["agentSession"]["messages"]
    assert [message["id"] for message in messages] == [
        _message_uuid("user-1"),
        _message_uuid("assistant-1"),
        _message_uuid("user-2"),
        _message_uuid("assistant-2"),
    ]
    async with db() as session:
        stored_message = await session.scalar(
            select(models.AgentSessionMessage).where(
                models.AgentSessionMessage.message_id == _message_uuid("assistant-2")
            )
        )
        assert stored_message is not None
        assert stored_message.message_id == stored_message.message.id


async def test_truncate_agent_session_restores_the_latest_surviving_compaction_point(
    db: DbSessionFactory,
    gql_client: AsyncGraphQLClient,
) -> None:
    agent_session_id = await _seed_session_with_transcript(db)
    async with db() as session:
        agent_session_rowid = await session.scalar(select(models.AgentSession.id))
        assert agent_session_rowid is not None
        additional_messages = [
            _build_compaction_message(
                message_id=_message_uuid("compaction-1"), summary="first summary"
            ),
            PhoenixUIMessage(
                id=_message_uuid("user-3"),
                role="user",
                parts=[TextUIPart(text="Continue")],
            ),
            PhoenixUIMessage(
                id=_message_uuid("assistant-3"),
                role="assistant",
                parts=[TextUIPart(text="Continued")],
            ),
            _build_compaction_message(
                message_id=_message_uuid("compaction-2"), summary="second summary"
            ),
            PhoenixUIMessage(
                id=_message_uuid("user-4"),
                role="user",
                parts=[TextUIPart(text="Continue again")],
            ),
            PhoenixUIMessage(
                id=_message_uuid("assistant-4"),
                role="assistant",
                parts=[TextUIPart(text="Continued again")],
            ),
        ]
        additional_rows = [
            models.AgentSessionMessage(
                agent_session_id=agent_session_rowid,
                message=message,
            )
            for message in additional_messages
        ]
        session.add_all(additional_rows)

    response = await gql_client.execute(
        query=_TRUNCATE_MUTATION,
        variables={"id": agent_session_id, "messageId": _message_uuid("user-3")},
    )

    assert not response.errors
    assert response.data is not None
    messages = response.data["truncateAgentSession"]["agentSession"]["messages"]
    assert [message["id"] for message in messages][-1] == _message_uuid("compaction-1")
    async with db() as session:
        surviving_compaction_message_count = await session.scalar(
            select(func.count())
            .select_from(models.AgentSessionMessage)
            .where(models.AgentSessionMessage.is_compaction_message)
        )
        history = await _load_agent_session_history(
            session,
            agent_session_rowid=agent_session_rowid,
        )
    assert surviving_compaction_message_count == 1
    assert [row.message.id for row in history] == [_message_uuid("compaction-1")]


async def test_truncate_agent_session_with_unknown_message_id_is_not_found(
    db: DbSessionFactory,
    gql_client: AsyncGraphQLClient,
) -> None:
    agent_session_id = await _seed_session_with_transcript(db)

    response = await gql_client.execute(
        query=_TRUNCATE_MUTATION,
        variables={"id": agent_session_id, "messageId": "missing"},
    )
    assert response.errors
    assert "No message found" in response.errors[0].message
    async with db() as session:
        assert len((await session.scalars(select(models.AgentSessionMessage))).all()) == len(
            _transcript_messages()
        )


async def test_truncate_agent_session_accepts_an_ephemeral_session_awaiting_the_sweeper(
    db: DbSessionFactory,
    gql_client: AsyncGraphQLClient,
) -> None:
    agent_session_id = await _seed_session_with_transcript(
        db,
        is_ephemeral=True,
        updated_at=datetime.now(timezone.utc)
        - timedelta(hours=EPHEMERAL_AGENT_SESSION_TIME_TO_LIVE_HOURS + 1),
    )

    response = await gql_client.execute(
        query=_TRUNCATE_MUTATION,
        variables={"id": agent_session_id, "messageId": _message_uuid("user-2")},
    )

    assert not response.errors
    async with db() as session:
        assert len((await session.scalars(select(models.AgentSessionMessage))).all()) < len(
            _transcript_messages()
        )


async def test_branch_agent_session_copies_the_truncated_transcript(
    db: DbSessionFactory,
    gql_client: AsyncGraphQLClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    source_agent_session_id = await _seed_session_with_transcript(db)
    configured_project_name = "configured-assistant-project"
    monkeypatch.setenv("PHOENIX_AGENTS_ASSISTANT_PROJECT_NAME", configured_project_name)

    response = await gql_client.execute(
        query=_BRANCH_MUTATION,
        variables={"id": source_agent_session_id, "messageId": _message_uuid("user-2")},
    )
    assert not response.errors
    assert response.data is not None
    payload = response.data["branchAgentSession"]
    branch = payload["agentSession"]
    assert branch["id"] != source_agent_session_id
    assert branch["title"] == ""
    assert branch["model"] == {
        "__typename": "AgentBuiltinProviderModelSelection",
        "provider": "OPENAI",
        "modelName": "gpt-test",
        "openaiApiType": "RESPONSES",
    }
    branch_message_ids = [message["id"] for message in branch["messages"]]
    assert len(branch_message_ids) == 2
    assert all(UUID(message_id).version == 4 for message_id in branch_message_ids)
    assert set(branch_message_ids).isdisjoint(
        {_message_uuid("user-1"), _message_uuid("assistant-1")}
    )
    async with db() as session:
        agent_sessions = (await session.scalars(select(models.AgentSession))).all()
        assert len(agent_sessions) == 2
        # Branching leaves the source transcript untouched.
        source_rowid, branch_rowid = sorted(agent_session.id for agent_session in agent_sessions)
        source_messages = (
            await session.scalars(
                select(models.AgentSessionMessage)
                .where(models.AgentSessionMessage.agent_session_id == source_rowid)
                .order_by(models.AgentSessionMessage.id)
            )
        ).all()
        branch_messages = (
            await session.scalars(
                select(models.AgentSessionMessage)
                .where(models.AgentSessionMessage.agent_session_id == branch_rowid)
                .order_by(models.AgentSessionMessage.id)
            )
        ).all()
        assert len(source_messages) == len(_transcript_messages())
        assert len(branch_messages) == 2
        assert [row.message_id for row in branch_messages] == [
            row.message.id for row in branch_messages
        ]
        assert set(row.message_id for row in branch_messages).isdisjoint(
            row.message_id for row in source_messages
        )
        # The branch gets its own OTel session identity (derived from its own
        # row id) and uses the currently configured trace project.
        source_session, branch_session = sorted(
            agent_sessions, key=lambda agent_session: agent_session.id
        )
        assert get_otel_session_id(
            project_name=branch_session.project_name,
            agent_session_rowid=branch_session.id,
        ) != get_otel_session_id(
            project_name=source_session.project_name,
            agent_session_rowid=source_session.id,
        )
        assert branch_session.project_name == configured_project_name
        assert branch_session.project_name != source_session.project_name


async def test_branch_agent_session_copies_durable_compaction_points(
    db: DbSessionFactory,
    gql_client: AsyncGraphQLClient,
) -> None:
    source_agent_session_id = await _seed_session_with_transcript(db)
    async with db() as session:
        source_session_rowid = await session.scalar(select(models.AgentSession.id))
        assert source_session_rowid is not None
        compaction_row = models.AgentSessionMessage(
            agent_session_id=source_session_rowid,
            message=_build_compaction_message(
                message_id=_message_uuid("source-compaction"),
                summary="durable summary",
            ),
        )
        assistant_row = models.AgentSessionMessage(
            agent_session_id=source_session_rowid,
            message=PhoenixUIMessage(
                id=_message_uuid("assistant-after-compaction"),
                role="assistant",
                parts=[TextUIPart(text="retained answer")],
            ),
        )
        session.add_all((compaction_row, assistant_row))

    response = await gql_client.execute(
        query=_BRANCH_MUTATION,
        variables={
            "id": source_agent_session_id,
            "messageId": _message_uuid("assistant-after-compaction"),
        },
    )

    assert not response.errors
    assert response.data is not None
    branch_messages = response.data["branchAgentSession"]["agentSession"]["messages"]
    copied_compaction = next(
        message
        for message in branch_messages
        if message.get("metadata", {}).get("isCompactionMessage") is True
    )
    assert copied_compaction["id"] != _message_uuid("source-compaction")
    async with db() as session:
        compaction_message_count = await session.scalar(
            select(func.count())
            .select_from(models.AgentSessionMessage)
            .where(models.AgentSessionMessage.is_compaction_message)
        )
    assert compaction_message_count == 2


async def test_branch_agent_session_copies_the_source_title(
    db: DbSessionFactory,
    gql_client: AsyncGraphQLClient,
) -> None:
    source_agent_session_id = await _seed_session_with_transcript(db, title="Debugging traces")

    response = await gql_client.execute(
        query=_BRANCH_MUTATION,
        variables={"id": source_agent_session_id, "messageId": _message_uuid("assistant-1")},
    )
    assert not response.errors
    assert response.data is not None
    assert response.data["branchAgentSession"]["agentSession"]["title"] == "Debugging traces"


async def test_branch_agent_session_preserves_temporary_mode(
    db: DbSessionFactory,
    gql_client: AsyncGraphQLClient,
) -> None:
    source_agent_session_id = await _seed_session_with_transcript(db, is_ephemeral=True)

    response = await gql_client.execute(
        query=_BRANCH_MUTATION,
        variables={"id": source_agent_session_id, "messageId": _message_uuid("assistant-1")},
    )

    assert not response.errors
    assert response.data is not None
    assert response.data["branchAgentSession"]["agentSession"]["isEphemeral"] is True


async def test_branch_agent_session_at_an_assistant_message_includes_it(
    db: DbSessionFactory,
    gql_client: AsyncGraphQLClient,
) -> None:
    source_agent_session_id = await _seed_session_with_transcript(db)

    response = await gql_client.execute(
        query=_BRANCH_MUTATION,
        variables={"id": source_agent_session_id, "messageId": _message_uuid("assistant-2")},
    )

    assert not response.errors
    assert response.data is not None
    messages = response.data["branchAgentSession"]["agentSession"]["messages"]
    assert len(messages) == 4
    assert messages[-1]["role"] == "assistant"


async def test_branch_agent_session_with_unknown_message_id_is_not_found(
    db: DbSessionFactory,
    gql_client: AsyncGraphQLClient,
) -> None:
    source_agent_session_id = await _seed_session_with_transcript(db)

    response = await gql_client.execute(
        query=_BRANCH_MUTATION,
        variables={"id": source_agent_session_id, "messageId": "missing"},
    )

    assert response.errors
    assert "No message found" in response.errors[0].message
    async with db() as session:
        assert len((await session.scalars(select(models.AgentSession))).all()) == 1


async def test_branch_agent_session_accepts_an_ephemeral_source_awaiting_the_sweeper(
    db: DbSessionFactory,
    gql_client: AsyncGraphQLClient,
) -> None:
    source_agent_session_id = await _seed_session_with_transcript(
        db,
        is_ephemeral=True,
        updated_at=datetime.now(timezone.utc)
        - timedelta(hours=EPHEMERAL_AGENT_SESSION_TIME_TO_LIVE_HOURS + 1),
    )

    response = await gql_client.execute(
        query=_BRANCH_MUTATION,
        variables={"id": source_agent_session_id, "messageId": _message_uuid("assistant-1")},
    )

    assert not response.errors
    assert response.data is not None
    assert response.data["branchAgentSession"]["agentSession"]["isEphemeral"] is True
    async with db() as session:
        branched = (await session.scalars(select(models.AgentSession))).all()
        assert len(branched) == 2
        assert all(agent_session.is_ephemeral for agent_session in branched)


async def test_create_agent_session_creates_empty_owned_session(
    db: DbSessionFactory,
    gql_client: AsyncGraphQLClient,
) -> None:
    response = await gql_client.execute(
        query=_CREATE_MUTATION,
        variables={"title": ""},
    )
    assert not response.errors
    assert response.data is not None
    payload = response.data["createAgentSession"]["agentSession"]
    assert payload["title"] == ""
    assert payload["isEphemeral"] is False
    assert payload["model"] == {
        "__typename": "AgentBuiltinProviderModelSelection",
        "provider": "OPENAI",
        "modelName": "gpt-test",
        "openaiApiType": "RESPONSES",
    }
    assert payload["messages"] == []
    async with db() as session:
        agent_sessions = (await session.scalars(select(models.AgentSession))).all()
        assert len(agent_sessions) == 1
        agent_session = agent_sessions[0]
        assert payload["id"] == str(GlobalID("AgentSession", str(agent_session.id)))
        assert agent_session.user_id is None
        assert agent_session.title == ""
        assert agent_session.is_ephemeral is False
        assert agent_session.model_provider.value == "OPENAI"
        assert agent_session.model_name == "gpt-test"
        assert agent_session.builtin_provider is not None
        assert (await session.scalars(select(models.AgentSessionMessage))).all() == []


async def test_create_agent_session_requires_a_model(
    gql_client: AsyncGraphQLClient,
) -> None:
    response = await gql_client.execute(
        query="""
          mutation {
            createAgentSession(input: {}) {
              agentSession { id }
            }
          }
        """
    )

    assert response.errors
    assert "model" in response.errors[0].message


async def test_create_agent_session_can_create_temporary_session(
    db: DbSessionFactory,
    gql_client: AsyncGraphQLClient,
) -> None:
    response = await gql_client.execute(
        query="""
          mutation {
            createAgentSession(
              input: {
                isEphemeral: true
                model: { builtin: { provider: OPENAI, modelName: "gpt-test" } }
              }
            ) {
              agentSession {
                isEphemeral
              }
            }
          }
        """,
    )

    assert not response.errors
    assert response.data is not None
    assert response.data["createAgentSession"]["agentSession"]["isEphemeral"] is True
    async with db() as session:
        agent_session = await session.scalar(select(models.AgentSession))
        assert agent_session is not None
        assert agent_session.is_ephemeral is True


async def test_create_agent_session_persists_a_trimmed_title(
    db: DbSessionFactory,
    gql_client: AsyncGraphQLClient,
) -> None:
    response = await gql_client.execute(
        query=_CREATE_MUTATION,
        variables={"title": "  (branch) Debugging traces  "},
    )
    assert not response.errors
    assert response.data is not None
    assert (
        response.data["createAgentSession"]["agentSession"]["title"] == "(branch) Debugging traces"
    )
    async with db() as session:
        agent_session = await session.scalar(select(models.AgentSession))
        assert agent_session is not None
        assert agent_session.title == "(branch) Debugging traces"


async def test_create_agent_session_mints_distinct_sessions(
    db: DbSessionFactory,
    gql_client: AsyncGraphQLClient,
) -> None:
    first = await gql_client.execute(query=_CREATE_MUTATION, variables={"title": ""})
    second = await gql_client.execute(query=_CREATE_MUTATION, variables={"title": ""})
    assert not first.errors and not second.errors
    assert first.data is not None and second.data is not None
    assert (
        first.data["createAgentSession"]["agentSession"]["id"]
        != second.data["createAgentSession"]["agentSession"]["id"]
    )
    async with db() as session:
        agent_session_rowids = (await session.scalars(select(models.AgentSession.id))).all()
        assert len(set(agent_session_rowids)) == 2


async def test_create_agent_session_rejects_long_title(
    gql_client: AsyncGraphQLClient,
) -> None:
    response = await gql_client.execute(
        query=_CREATE_MUTATION,
        variables={"title": "x" * (MAX_AGENT_SESSION_TITLE_LENGTH + 1)},
    )

    assert response.errors
    assert response.errors[0].message == (
        f"Agent session title cannot exceed {MAX_AGENT_SESSION_TITLE_LENGTH} characters"
    )


async def test_update_agent_session_title(
    db: DbSessionFactory,
    gql_client: AsyncGraphQLClient,
) -> None:
    async with db() as session:
        agent_session = models.AgentSession(
            **_agent_session_model_kwargs(),
            user_id=None,
            title="Old title",
            project_name="assistant_agent",
        )
        session.add(agent_session)
        await session.flush()
        agent_session_id = str(GlobalID("AgentSession", str(agent_session.id)))

    response = await gql_client.execute(
        query=_UPDATE_TITLE_MUTATION,
        variables={"id": agent_session_id, "title": "  New title  "},
    )

    assert not response.errors
    assert response.data == {
        "updateAgentSessionTitle": {"agentSession": {"id": agent_session_id, "title": "New title"}}
    }
    async with db() as session:
        assert await session.scalar(select(models.AgentSession.title)) == "New title"


async def test_update_agent_session_model_moves_the_session(
    db: DbSessionFactory,
    gql_client: AsyncGraphQLClient,
) -> None:
    """The mutation is the web client's counterpart to the model REST route:
    the only way to move an existing session to a different model."""
    async with db() as session:
        agent_session = models.AgentSession(
            **_agent_session_model_kwargs(),
            user_id=None,
            title="Session",
            project_name="assistant_agent",
        )
        session.add(agent_session)
        await session.flush()
        agent_session_id = str(GlobalID("AgentSession", str(agent_session.id)))

    response = await gql_client.execute(
        query=_UPDATE_MODEL_MUTATION,
        variables={
            "id": agent_session_id,
            "model": {
                "builtin": {
                    "provider": "ANTHROPIC",
                    "modelName": "claude-opus-4-6",
                }
            },
        },
    )

    assert not response.errors
    assert response.data == {
        "updateAgentSessionModel": {
            "agentSession": {
                "id": agent_session_id,
                "model": {
                    "__typename": "AgentBuiltinProviderModelSelection",
                    "provider": "ANTHROPIC",
                    "modelName": "claude-opus-4-6",
                },
            }
        }
    }
    async with db() as session:
        refreshed = await session.scalar(select(models.AgentSession))
        assert refreshed is not None
        assert refreshed.model_provider.value == "ANTHROPIC"
        assert refreshed.model_name == "claude-opus-4-6"


async def test_update_agent_session_model_rejects_a_missing_custom_provider(
    db: DbSessionFactory,
    gql_client: AsyncGraphQLClient,
) -> None:
    async with db() as session:
        agent_session = models.AgentSession(
            **_agent_session_model_kwargs(),
            user_id=None,
            title="Session",
            project_name="assistant_agent",
        )
        session.add(agent_session)
        await session.flush()
        agent_session_id = str(GlobalID("AgentSession", str(agent_session.id)))
        original_model_name = agent_session.model_name

    response = await gql_client.execute(
        query=_UPDATE_MODEL_MUTATION,
        variables={
            "id": agent_session_id,
            "model": {
                "custom": {
                    "providerId": str(GlobalID("GenerativeModelCustomProvider", "999")),
                    "modelName": "custom-model",
                }
            },
        },
    )

    assert response.errors
    async with db() as session:
        refreshed = await session.scalar(select(models.AgentSession))
        assert refreshed is not None
        assert refreshed.model_name == original_model_name


async def test_update_agent_session_model_is_rejected_while_a_turn_is_streaming(
    db: DbSessionFactory,
    gql_client: AsyncGraphQLClient,
) -> None:
    """A streaming turn runs on the model it read under the turn lock, so the
    mutation must not flip the session's model out from under it."""
    async with db() as session:
        agent_session = models.AgentSession(
            **_agent_session_model_kwargs(),
            user_id=None,
            title="Session",
            project_name="assistant_agent",
            heartbeat_at=datetime.now(timezone.utc),
        )
        session.add(agent_session)
        await session.flush()
        agent_session_id = str(GlobalID("AgentSession", str(agent_session.id)))
        original_model_name = agent_session.model_name

    response = await gql_client.execute(
        query=_UPDATE_MODEL_MUTATION,
        variables={
            "id": agent_session_id,
            "model": {
                "builtin": {
                    "provider": "ANTHROPIC",
                    "modelName": "claude-opus-4-6",
                }
            },
        },
    )

    assert response.errors
    assert "while a turn is streaming" in response.errors[0].message
    async with db() as session:
        refreshed = await session.scalar(select(models.AgentSession))
        assert refreshed is not None
        assert refreshed.model_name == original_model_name
        assert refreshed.heartbeat_at is not None


async def test_update_agent_session_model_ignores_a_stale_session_lock(
    db: DbSessionFactory,
    gql_client: AsyncGraphQLClient,
) -> None:
    """A heartbeat older than the staleness window belongs to an abandoned
    turn, so it must not wedge the session on its old model."""
    async with db() as session:
        agent_session = models.AgentSession(
            **_agent_session_model_kwargs(),
            user_id=None,
            title="Session",
            project_name="assistant_agent",
            heartbeat_at=datetime.now(timezone.utc) - TURN_LOCK_STALENESS * 2,
        )
        session.add(agent_session)
        await session.flush()
        agent_session_id = str(GlobalID("AgentSession", str(agent_session.id)))

    response = await gql_client.execute(
        query=_UPDATE_MODEL_MUTATION,
        variables={
            "id": agent_session_id,
            "model": {
                "builtin": {
                    "provider": "ANTHROPIC",
                    "modelName": "claude-opus-4-6",
                }
            },
        },
    )

    assert not response.errors
    async with db() as session:
        refreshed = await session.scalar(select(models.AgentSession))
        assert refreshed is not None
        assert refreshed.model_name == "claude-opus-4-6"


async def test_update_agent_session_title_rejects_empty_title(
    db: DbSessionFactory,
    gql_client: AsyncGraphQLClient,
) -> None:
    async with db() as session:
        agent_session = models.AgentSession(
            **_agent_session_model_kwargs(),
            user_id=None,
            title="Old title",
            project_name="assistant_agent",
        )
        session.add(agent_session)
        await session.flush()
        agent_session_id = str(GlobalID("AgentSession", str(agent_session.id)))

    response = await gql_client.execute(
        query=_UPDATE_TITLE_MUTATION,
        variables={"id": agent_session_id, "title": "   "},
    )

    assert response.errors
    assert response.errors[0].message == "Agent session title cannot be empty"
    async with db() as session:
        assert await session.scalar(select(models.AgentSession.title)) == "Old title"


async def test_update_agent_session_title_rejects_long_title(
    db: DbSessionFactory,
    gql_client: AsyncGraphQLClient,
) -> None:
    async with db() as session:
        agent_session = models.AgentSession(
            **_agent_session_model_kwargs(),
            user_id=None,
            title="Old title",
            project_name="assistant_agent",
        )
        session.add(agent_session)
        await session.flush()
        agent_session_id = str(GlobalID("AgentSession", str(agent_session.id)))

    response = await gql_client.execute(
        query=_UPDATE_TITLE_MUTATION,
        variables={
            "id": agent_session_id,
            "title": "x" * (MAX_AGENT_SESSION_TITLE_LENGTH + 1),
        },
    )

    assert response.errors
    assert response.errors[0].message == (
        f"Agent session title cannot exceed {MAX_AGENT_SESSION_TITLE_LENGTH} characters"
    )
    async with db() as session:
        assert await session.scalar(select(models.AgentSession.title)) == "Old title"


async def test_delete_agent_session_cascades_snapshot(
    db: DbSessionFactory,
    gql_client: AsyncGraphQLClient,
) -> None:
    now = datetime(2026, 1, 1, tzinfo=timezone.utc)
    async with db() as session:
        agent_session = models.AgentSession(
            **_agent_session_model_kwargs(),
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
                message=PhoenixUIMessage(id=_message_uuid("m1"), role="user", parts=[]),
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


@pytest.fixture
def locked_storage(db: DbSessionFactory) -> Iterator[None]:
    """Put the database in the state the disk-usage monitor sets when full."""
    db.should_not_insert_or_update = True
    try:
        yield
    finally:
        db.should_not_insert_or_update = False


async def test_write_mutations_report_insufficient_storage_when_writes_are_locked(
    db: DbSessionFactory,
    gql_client: AsyncGraphQLClient,
    locked_storage: None,
) -> None:
    """A locked database must say so, not fail with whatever the driver raised."""
    agent_session_id = await _seed_session_with_transcript(db)

    for mutation, variables in (
        (_CREATE_MUTATION, {"title": ""}),
        (
            _BRANCH_MUTATION,
            {"id": agent_session_id, "messageId": _message_uuid("assistant-1")},
        ),
        (_UPDATE_TITLE_MUTATION, {"id": agent_session_id, "title": "New title"}),
    ):
        response = await gql_client.execute(query=mutation, variables=variables)

        assert response.errors, mutation
        assert insufficient_storage_message() in response.errors[0].message, mutation


async def test_truncate_and_delete_still_work_when_writes_are_locked(
    db: DbSessionFactory,
    gql_client: AsyncGraphQLClient,
    locked_storage: None,
) -> None:
    """Deleting is how a user frees space, so it must not be gated on storage."""
    agent_session_id = await _seed_session_with_transcript(db)

    truncated = await gql_client.execute(
        query=_TRUNCATE_MUTATION,
        variables={"id": agent_session_id, "messageId": _message_uuid("user-2")},
    )
    assert not truncated.errors

    deleted = await gql_client.execute(
        query=_DELETE_MUTATION,
        variables={"id": agent_session_id},
    )
    assert not deleted.errors
    async with db() as session:
        assert (await session.scalars(select(models.AgentSession))).all() == []

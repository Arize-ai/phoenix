from datetime import datetime, timedelta, timezone
from uuid import UUID

import pytest
from fastapi import FastAPI
from sqlalchemy import select
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.db.types.data_stream_protocol import (
    PhoenixUIMessage,
    TextUIPart,
)
from phoenix.server.api.routers.agents import (
    _build_compaction_message,
    _load_agent_session_history,
)
from phoenix.server.settings.registry import AgentAssistantEnabledSetting
from phoenix.server.types import DbSessionFactory
from tests.unit.graphql import AsyncGraphQLClient

_CREATE_MUTATION = """
  mutation ($title: String!) {
    createAgentSession(input: { title: $title }) {
      agentSession {
        id
        title
        isTemporary
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
        isTemporary
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
            id="user-1",
            role="user",
            parts=[TextUIPart(text="How do I trace OpenAI?")],
        ),
        PhoenixUIMessage(
            id="assistant-1",
            role="assistant",
            parts=[TextUIPart(text="Use register().")],
        ),
        PhoenixUIMessage(
            id="user-2",
            role="user",
            parts=[TextUIPart(text="Show "), TextUIPart(text="an example")],
        ),
        PhoenixUIMessage(
            id="assistant-2",
            role="assistant",
            parts=[TextUIPart(text="Here is an example.")],
        ),
    ]


async def _seed_session_with_transcript(
    db: DbSessionFactory,
    *,
    title: str = "",
    expires_at: datetime | None = None,
) -> str:
    async with db() as session:
        agent_session = models.AgentSession(
            project_session_id="12121212-1212-4121-8121-121212121212",
            user_id=None,
            title=title,
            project_name="assistant_agent",
            expires_at=expires_at,
        )
        session.add(agent_session)
        await session.flush()
        session.add_all(
            models.AgentSessionMessage(
                agent_session_id=agent_session.id,
                position=position,
                message=message,
            )
            for position, message in enumerate(_transcript_messages())
        )
        return str(GlobalID("AgentSession", str(agent_session.id)))


async def test_truncate_agent_session_at_a_user_message_removes_it_and_later_turns(
    db: DbSessionFactory,
    gql_client: AsyncGraphQLClient,
) -> None:
    agent_session_id = await _seed_session_with_transcript(db)
    async with db() as session:
        retained_message_rowids = list(
            await session.scalars(
                select(models.AgentSessionMessage.id)
                .where(models.AgentSessionMessage.position < 2)
                .order_by(models.AgentSessionMessage.position)
            )
        )

    response = await gql_client.execute(
        query=_TRUNCATE_MUTATION,
        variables={"id": agent_session_id, "messageId": "user-2"},
    )
    assert not response.errors
    assert response.data is not None
    payload = response.data["truncateAgentSession"]
    # The user target and everything after it are removed.
    assert [message["id"] for message in payload["agentSession"]["messages"]] == [
        "user-1",
        "assistant-1",
    ]
    async with db() as session:
        stored_message_rows = (
            await session.scalars(
                select(models.AgentSessionMessage).order_by(models.AgentSessionMessage.position)
            )
        ).all()
    assert [row.message.id for row in stored_message_rows] == ["user-1", "assistant-1"]
    assert [row.message_id for row in stored_message_rows] == ["user-1", "assistant-1"]
    assert [row.id for row in stored_message_rows] == retained_message_rowids


async def test_truncate_agent_session_at_an_assistant_message_retains_it(
    db: DbSessionFactory,
    gql_client: AsyncGraphQLClient,
) -> None:
    agent_session_id = await _seed_session_with_transcript(db)

    response = await gql_client.execute(
        query=_TRUNCATE_MUTATION,
        variables={"id": agent_session_id, "messageId": "assistant-2"},
    )
    assert not response.errors
    assert response.data is not None
    payload = response.data["truncateAgentSession"]
    messages = payload["agentSession"]["messages"]
    assert [message["id"] for message in messages] == [
        "user-1",
        "assistant-1",
        "user-2",
        "assistant-2",
    ]
    async with db() as session:
        stored_message = await session.scalar(
            select(models.AgentSessionMessage).where(
                models.AgentSessionMessage.message_id == "assistant-2"
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
            _build_compaction_message(message_id="compaction-1", summary="first summary"),
            PhoenixUIMessage(
                id="user-3",
                role="user",
                parts=[TextUIPart(text="Continue")],
            ),
            PhoenixUIMessage(
                id="assistant-3",
                role="assistant",
                parts=[TextUIPart(text="Continued")],
            ),
            _build_compaction_message(message_id="compaction-2", summary="second summary"),
            PhoenixUIMessage(
                id="user-4",
                role="user",
                parts=[TextUIPart(text="Continue again")],
            ),
            PhoenixUIMessage(
                id="assistant-4",
                role="assistant",
                parts=[TextUIPart(text="Continued again")],
            ),
        ]
        additional_rows = [
            models.AgentSessionMessage(
                agent_session_id=agent_session_rowid,
                position=position,
                message=message,
            )
            for position, message in enumerate(additional_messages, start=4)
        ]
        session.add_all(additional_rows)
        await session.flush()
        session.add_all(
            models.AgentSessionCompactionPoint(agent_session_message_id=row.id)
            for row in (additional_rows[0], additional_rows[3])
        )

    response = await gql_client.execute(
        query=_TRUNCATE_MUTATION,
        variables={"id": agent_session_id, "messageId": "user-3"},
    )

    assert not response.errors
    assert response.data is not None
    messages = response.data["truncateAgentSession"]["agentSession"]["messages"]
    assert [message["id"] for message in messages][-1] == "compaction-1"
    async with db() as session:
        surviving_points = (await session.scalars(select(models.AgentSessionCompactionPoint))).all()
        history = await _load_agent_session_history(
            session,
            agent_session_rowid=agent_session_rowid,
        )
    assert len(surviving_points) == 1
    assert [row.message.id for row in history] == ["compaction-1"]


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


async def test_truncate_agent_session_rejects_an_expired_temporary_session(
    db: DbSessionFactory,
    gql_client: AsyncGraphQLClient,
) -> None:
    agent_session_id = await _seed_session_with_transcript(
        db,
        expires_at=datetime.now(timezone.utc) - timedelta(hours=1),
    )

    response = await gql_client.execute(
        query=_TRUNCATE_MUTATION,
        variables={"id": agent_session_id, "messageId": "user-2"},
    )

    assert response.errors
    assert "No agent session found" in response.errors[0].message
    # The expired session's transcript is left untouched.
    async with db() as session:
        assert len((await session.scalars(select(models.AgentSessionMessage))).all()) == len(
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
        variables={"id": source_agent_session_id, "messageId": "user-2"},
    )
    assert not response.errors
    assert response.data is not None
    payload = response.data["branchAgentSession"]
    branch = payload["agentSession"]
    assert branch["id"] != source_agent_session_id
    assert branch["title"] == ""
    branch_message_ids = [message["id"] for message in branch["messages"]]
    assert len(branch_message_ids) == 2
    assert all(UUID(message_id).version == 4 for message_id in branch_message_ids)
    assert set(branch_message_ids).isdisjoint({"user-1", "assistant-1"})
    async with db() as session:
        agent_sessions = (await session.scalars(select(models.AgentSession))).all()
        assert len(agent_sessions) == 2
        # Branching leaves the source transcript untouched.
        source_rowid, branch_rowid = sorted(agent_session.id for agent_session in agent_sessions)
        source_messages = (
            await session.scalars(
                select(models.AgentSessionMessage)
                .where(models.AgentSessionMessage.agent_session_id == source_rowid)
                .order_by(models.AgentSessionMessage.position)
            )
        ).all()
        branch_messages = (
            await session.scalars(
                select(models.AgentSessionMessage)
                .where(models.AgentSessionMessage.agent_session_id == branch_rowid)
                .order_by(models.AgentSessionMessage.position)
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
        # The branch mints its own OTel session identity and uses the currently
        # configured trace project.
        source_session, branch_session = sorted(
            agent_sessions, key=lambda agent_session: agent_session.id
        )
        assert branch_session.project_session_id != source_session.project_session_id
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
            position=4,
            message=_build_compaction_message(
                message_id="source-compaction",
                summary="durable summary",
            ),
        )
        assistant_row = models.AgentSessionMessage(
            agent_session_id=source_session_rowid,
            position=5,
            message=PhoenixUIMessage(
                id="assistant-after-compaction",
                role="assistant",
                parts=[TextUIPart(text="retained answer")],
            ),
        )
        session.add_all((compaction_row, assistant_row))
        await session.flush()
        session.add(models.AgentSessionCompactionPoint(agent_session_message_id=compaction_row.id))

    response = await gql_client.execute(
        query=_BRANCH_MUTATION,
        variables={
            "id": source_agent_session_id,
            "messageId": "assistant-after-compaction",
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
    assert copied_compaction["id"] != "source-compaction"
    async with db() as session:
        compaction_points = (
            await session.scalars(select(models.AgentSessionCompactionPoint))
        ).all()
    assert len(compaction_points) == 2


async def test_branch_agent_session_copies_the_source_title(
    db: DbSessionFactory,
    gql_client: AsyncGraphQLClient,
) -> None:
    source_agent_session_id = await _seed_session_with_transcript(db, title="Debugging traces")

    response = await gql_client.execute(
        query=_BRANCH_MUTATION,
        variables={"id": source_agent_session_id, "messageId": "assistant-1"},
    )
    assert not response.errors
    assert response.data is not None
    assert response.data["branchAgentSession"]["agentSession"]["title"] == "Debugging traces"


async def test_branch_agent_session_preserves_temporary_mode(
    db: DbSessionFactory,
    gql_client: AsyncGraphQLClient,
) -> None:
    source_agent_session_id = await _seed_session_with_transcript(
        db,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
    )

    response = await gql_client.execute(
        query=_BRANCH_MUTATION,
        variables={"id": source_agent_session_id, "messageId": "assistant-1"},
    )

    assert not response.errors
    assert response.data is not None
    assert response.data["branchAgentSession"]["agentSession"]["isTemporary"] is True


async def test_branch_agent_session_at_an_assistant_message_includes_it(
    db: DbSessionFactory,
    gql_client: AsyncGraphQLClient,
) -> None:
    source_agent_session_id = await _seed_session_with_transcript(db)

    response = await gql_client.execute(
        query=_BRANCH_MUTATION,
        variables={"id": source_agent_session_id, "messageId": "assistant-2"},
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


async def test_branch_agent_session_rejects_an_expired_temporary_session(
    db: DbSessionFactory,
    gql_client: AsyncGraphQLClient,
) -> None:
    source_agent_session_id = await _seed_session_with_transcript(
        db,
        expires_at=datetime.now(timezone.utc) - timedelta(hours=1),
    )

    response = await gql_client.execute(
        query=_BRANCH_MUTATION,
        variables={"id": source_agent_session_id, "messageId": "assistant-1"},
    )

    assert response.errors
    assert "No agent session found" in response.errors[0].message
    # No branch session is minted from an expired source.
    async with db() as session:
        assert len((await session.scalars(select(models.AgentSession))).all()) == 1


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
    assert payload["isTemporary"] is False
    assert payload["messages"] == []
    async with db() as session:
        agent_sessions = (await session.scalars(select(models.AgentSession))).all()
        assert len(agent_sessions) == 1
        agent_session = agent_sessions[0]
        assert payload["id"] == str(GlobalID("AgentSession", str(agent_session.id)))
        assert agent_session.user_id is None
        assert agent_session.title == ""
        assert agent_session.project_session_id
        assert agent_session.expires_at is None
        assert (await session.scalars(select(models.AgentSessionMessage))).all() == []


async def test_create_agent_session_can_create_temporary_session(
    db: DbSessionFactory,
    gql_client: AsyncGraphQLClient,
) -> None:
    before_creation = datetime.now(timezone.utc)
    response = await gql_client.execute(
        query="""
          mutation {
            createAgentSession(input: { temporary: true }) {
              agentSession {
                isTemporary
              }
            }
          }
        """,
    )

    assert not response.errors
    assert response.data is not None
    assert response.data["createAgentSession"]["agentSession"]["isTemporary"] is True
    async with db() as session:
        agent_session = await session.scalar(select(models.AgentSession))
        assert agent_session is not None
        assert agent_session.expires_at is not None
        assert before_creation + timedelta(hours=23) < agent_session.expires_at
        assert agent_session.expires_at < before_creation + timedelta(hours=25)


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
        project_session_ids = (
            await session.scalars(select(models.AgentSession.project_session_id))
        ).all()
        assert len(set(project_session_ids)) == 2


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

from datetime import datetime, timezone

from sqlalchemy import select
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.db.types.data_stream_protocol import (
    PhoenixUIMessage,
    TextUIPart,
    ToolInputAvailablePart,
    ToolOutputAvailablePart,
)
from phoenix.server.types import DbSessionFactory
from tests.unit.graphql import AsyncGraphQLClient

_CREATE_MUTATION = """
  mutation ($title: String!) {
    createAgentSession(input: { title: $title }) {
      agentSession {
        id
        title
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


def _transcript_messages() -> list[PhoenixUIMessage]:
    """A two-turn transcript whose second assistant turn holds both a resolved
    and a still-pending tool call."""
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
            parts=[
                TextUIPart(text="Running a tool"),
                ToolOutputAvailablePart(
                    type="tool-bash",
                    tool_call_id="tool-call-1",
                    input={"command": "ls"},
                    output={"stdout": "ok"},
                ),
                ToolInputAvailablePart(
                    type="tool-bash",
                    tool_call_id="tool-call-2",
                    input={"command": "pwd"},
                ),
            ],
        ),
    ]


async def _seed_session_with_transcript(
    db: DbSessionFactory,
    *,
    title: str = "",
) -> str:
    async with db() as session:
        agent_session = models.AgentSession(
            project_session_id="12121212-1212-4121-8121-121212121212",
            user_id=None,
            title=title,
            project_name="assistant_agent",
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
    assert [row.id for row in stored_message_rows] == retained_message_rowids


async def test_truncate_agent_session_at_an_assistant_message_strips_pending_tool_calls(
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
    # An assistant target is retained, but its unresolved tool call is dropped.
    messages = payload["agentSession"]["messages"]
    assert [message["id"] for message in messages] == [
        "user-1",
        "assistant-1",
        "user-2",
        "assistant-2",
    ]
    retained_tool_call_ids = [
        part["toolCallId"] for part in messages[-1]["parts"] if part["type"].startswith("tool-")
    ]
    assert retained_tool_call_ids == ["tool-call-1"]


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


async def test_branch_agent_session_copies_the_truncated_transcript(
    db: DbSessionFactory,
    gql_client: AsyncGraphQLClient,
) -> None:
    source_agent_session_id = await _seed_session_with_transcript(db)

    response = await gql_client.execute(
        query=_BRANCH_MUTATION,
        variables={"id": source_agent_session_id, "messageId": "user-2"},
    )
    assert not response.errors
    assert response.data is not None
    payload = response.data["branchAgentSession"]
    branch = payload["agentSession"]
    assert branch["id"] != source_agent_session_id
    # The source is untitled, so the branch derives its title from the
    # truncated transcript's first user message.
    assert branch["title"] == "(branch) How do I trace OpenAI?"
    assert [message["id"] for message in branch["messages"]] == [
        "user-1",
        "assistant-1",
    ]
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
        # The branch mints its own OTel session identity but stays in the
        # source's trace project.
        source_session, branch_session = sorted(
            agent_sessions, key=lambda agent_session: agent_session.id
        )
        assert branch_session.project_session_id != source_session.project_session_id
        assert branch_session.project_name == source_session.project_name


async def test_branch_agent_session_reuses_the_source_title_with_a_branch_prefix(
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
    assert (
        response.data["branchAgentSession"]["agentSession"]["title"] == "(branch) Debugging traces"
    )


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
    assert payload["messages"] == []
    async with db() as session:
        agent_sessions = (await session.scalars(select(models.AgentSession))).all()
        assert len(agent_sessions) == 1
        agent_session = agent_sessions[0]
        assert payload["id"] == str(GlobalID("AgentSession", str(agent_session.id)))
        assert agent_session.user_id is None
        assert agent_session.title == ""
        assert agent_session.project_session_id
        assert (await session.scalars(select(models.AgentSessionMessage))).all() == []


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

from datetime import datetime, timezone

from sqlalchemy import select
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.db.types.data_stream_protocol import PhoenixUIMessage
from phoenix.server.types import DbSessionFactory
from tests.unit.graphql import AsyncGraphQLClient

_DELETE_MUTATION = """
  mutation ($id: ID!) {
    deleteAgentSession(input: { id: $id }) {
      deletedAgentSessionId
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

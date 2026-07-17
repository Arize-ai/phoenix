from datetime import datetime, timezone

from sqlalchemy import select
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.db.types.data_stream_protocol import PhoenixUIMessage
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

_DELETE_MUTATION = """
  mutation ($id: ID!) {
    deleteAgentSession(input: { id: $id }) {
      deletedAgentSessionId
    }
  }
"""


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

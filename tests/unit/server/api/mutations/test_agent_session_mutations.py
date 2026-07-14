from datetime import datetime, timezone

from sqlalchemy import select

from phoenix.db import models
from phoenix.server.types import DbSessionFactory
from tests.unit.graphql import AsyncGraphQLClient

_DELETE_MUTATION = """
  mutation ($sessionId: String!) {
    deleteAgentSession(input: { sessionId: $sessionId }) {
      deletedAgentSessionId
      sessionId
    }
  }
"""

async def test_delete_agent_session_cascades_snapshot(
    db: DbSessionFactory,
    gql_client: AsyncGraphQLClient,
) -> None:
    now = datetime(2026, 1, 1, tzinfo=timezone.utc)
    async with db() as session:
        agent_session = models.AgentSession(
            session_id="doomed",
            user_id=None,
            title="doomed session",
            messages=[{"id": "m1", "role": "user", "parts": []}],
            created_at=now,
            updated_at=now,
        )
        session.add(agent_session)
        await session.flush()
        session.add(
            models.AgentSessionSnapshot(
                agent_session_id=agent_session.id,
                bashkit_snapshot=b"shell-state",
            )
        )

    response = await gql_client.execute(query=_DELETE_MUTATION, variables={"sessionId": "doomed"})
    assert not response.errors
    assert response.data is not None
    assert response.data["deleteAgentSession"]["sessionId"] == "doomed"
    assert response.data["deleteAgentSession"]["deletedAgentSessionId"]
    async with db() as session:
        assert (await session.scalars(select(models.AgentSession))).all() == []
        assert (await session.scalars(select(models.AgentSessionSnapshot))).all() == []


async def test_delete_agent_session_not_found(
    gql_client: AsyncGraphQLClient,
) -> None:
    response = await gql_client.execute(
        query=_DELETE_MUTATION, variables={"sessionId": "nonexistent"}
    )
    assert response.errors
    assert "No agent session found" in response.errors[0].message

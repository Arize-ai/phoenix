from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from phoenix.db import models
from phoenix.db.types.data_stream_protocol import PhoenixUIMessage
from phoenix.server.daemons.agent_session_sweeper import AgentSessionSweeper
from phoenix.server.types import DbSessionFactory


async def test_agent_session_sweeper_deletes_only_expired_sessions_and_cascades(
    db: DbSessionFactory,
) -> None:
    now = datetime.now(timezone.utc)
    async with db() as session:
        expired = models.AgentSession(
            project_session_id="11111111-1111-4111-8111-111111111111",
            project_name="assistant_agent",
            user_id=None,
            title="expired",
            expires_at=now - timedelta(hours=1),
        )
        future = models.AgentSession(
            project_session_id="22222222-2222-4222-8222-222222222222",
            project_name="assistant_agent",
            user_id=None,
            title="future",
            expires_at=now + timedelta(hours=1),
        )
        persistent = models.AgentSession(
            project_session_id="33333333-3333-4333-8333-333333333333",
            project_name="assistant_agent",
            user_id=None,
            title="persistent",
            expires_at=None,
        )
        session.add_all((expired, future, persistent))
        await session.flush()
        expired_id = expired.id
        future_id = future.id
        persistent_id = persistent.id
        session.add(
            models.AgentSessionMessage(
                agent_session_id=expired_id,
                position=0,
                message=PhoenixUIMessage(id="message-1", role="user", parts=[]),
            )
        )
        session.add(
            models.AgentSessionSnapshot(
                agent_session_id=expired_id,
                bashkit_snapshot=b"shell-state",
            )
        )

    await AgentSessionSweeper(db)._delete_expired_agent_sessions()

    async with db() as session:
        remaining_ids = set((await session.scalars(select(models.AgentSession.id))).all())
        assert remaining_ids == {future_id, persistent_id}
        assert expired_id not in remaining_ids
        assert (await session.scalars(select(models.AgentSessionMessage))).all() == []
        assert (await session.scalars(select(models.AgentSessionSnapshot))).all() == []

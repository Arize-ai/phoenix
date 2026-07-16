from datetime import datetime, timedelta, timezone

import sqlalchemy as sa

from phoenix.config import TEMPORARY_AGENT_SESSION_TIME_TO_LIVE_HOURS
from phoenix.db import models
from phoenix.db.types.data_stream_protocol import PhoenixUIMessage
from phoenix.server.daemons.agent_session_sweeper import AgentSessionSweeper
from phoenix.server.types import DbSessionFactory


async def test_agent_session_sweeper_deletes_only_stale_temporary_sessions(
    db: DbSessionFactory,
) -> None:
    now = datetime.now(timezone.utc)
    stale = now - timedelta(hours=TEMPORARY_AGENT_SESSION_TIME_TO_LIVE_HOURS + 1)

    async with db() as session:
        stale_temporary = models.AgentSession(
            session_id="11111111-1111-4111-8111-111111111111",
            project_name="assistant_agent",
            user_id=None,
            title="stale temporary",
            is_temporary=True,
            created_at=stale,
            updated_at=stale,
        )
        fresh_temporary = models.AgentSession(
            session_id="22222222-2222-4222-8222-222222222222",
            project_name="assistant_agent",
            user_id=None,
            title="fresh temporary",
            is_temporary=True,
            created_at=now,
            updated_at=now,
        )
        stale_persistent = models.AgentSession(
            session_id="33333333-3333-4333-8333-333333333333",
            project_name="assistant_agent",
            user_id=None,
            title="stale persistent",
            is_temporary=False,
            created_at=stale,
            updated_at=stale,
        )
        session.add_all([stale_temporary, fresh_temporary, stale_persistent])
        await session.flush()
        stale_temporary_id = stale_temporary.id
        fresh_temporary_id = fresh_temporary.id
        stale_persistent_id = stale_persistent.id
        session.add(
            models.AgentSessionMessage(
                agent_session_id=stale_temporary_id,
                position=0,
                message=PhoenixUIMessage(id="message-1", role="user", parts=[]),
            )
        )
        session.add(
            models.AgentSessionSnapshot(
                agent_session_id=stale_temporary_id,
                bashkit_snapshot=b"snapshot",
            )
        )

    await AgentSessionSweeper(db)._delete_temporary_agent_sessions()

    async with db() as session:
        remaining_ids = set((await session.scalars(sa.select(models.AgentSession.id))).all())
        assert remaining_ids == {fresh_temporary_id, stale_persistent_id}
        assert (
            await session.scalar(
                sa.select(models.AgentSessionMessage.id).where(
                    models.AgentSessionMessage.agent_session_id == stale_temporary_id
                )
            )
            is None
        )
        assert (
            await session.scalar(
                sa.select(models.AgentSessionSnapshot.id).where(
                    models.AgentSessionSnapshot.agent_session_id == stale_temporary_id
                )
            )
            is None
        )

from datetime import datetime, timedelta, timezone
from uuid import uuid4

from sqlalchemy import select

from phoenix.db import models
from phoenix.db.types.data_stream_protocol import PhoenixUIMessage
from phoenix.server.daemons.agent_session_sweeper import AgentSessionSweeper
from phoenix.server.daemons.system_settings import SystemSettings
from phoenix.server.settings.registry import SETTINGS_REGISTRY, AgentSessionRetentionSetting
from phoenix.server.types import DbSessionFactory


async def _make_settings(
    db: DbSessionFactory,
    retention: AgentSessionRetentionSetting | None = None,
) -> SystemSettings:
    settings = SystemSettings(db=db, registry=SETTINGS_REGISTRY)
    await settings.bootstrap()
    if retention is not None:
        await settings.update_agent_session_retention(retention)
    return settings


async def _add_agent_session(
    db: DbSessionFactory,
    *,
    title: str,
    user_id: int | None = None,
    updated_at: datetime | None = None,
    expires_at: datetime | None = None,
) -> int:
    async with db() as session:
        agent_session = models.AgentSession(
            project_session_id=str(uuid4()),
            project_name="assistant_agent",
            user_id=user_id,
            title=title,
            expires_at=expires_at,
        )
        if updated_at is not None:
            agent_session.created_at = updated_at
            agent_session.updated_at = updated_at
        session.add(agent_session)
        await session.flush()
        return agent_session.id


async def _add_user(
    db: DbSessionFactory,
    username: str,
    role_name: models.UserRoleName,
) -> int:
    async with db() as session:
        user_role = models.UserRole(name=role_name)
        session.add(user_role)
        await session.flush()
        user = models.User(
            user_role_id=user_role.id,
            username=username,
            email=f"{username}@example.com",
            password_hash=b"hash",
            password_salt=b"salt",
            reset_password=False,
            auth_method="LOCAL",
        )
        session.add(user)
        await session.flush()
        return user.id


async def _remaining_session_ids(db: DbSessionFactory) -> set[int]:
    async with db() as session:
        return set((await session.scalars(select(models.AgentSession.id))).all())


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

    settings = await _make_settings(db)
    await AgentSessionSweeper(db, settings=settings)._delete_expired_temporary_sessions()

    async with db() as session:
        remaining_ids = set((await session.scalars(select(models.AgentSession.id))).all())
        assert remaining_ids == {future_id, persistent_id}
        assert expired_id not in remaining_ids
        assert (await session.scalars(select(models.AgentSessionMessage))).all() == []
        assert (await session.scalars(select(models.AgentSessionSnapshot))).all() == []


async def test_idle_pass_deletes_idle_persisted_sessions_but_never_temporary_ones(
    db: DbSessionFactory,
) -> None:
    now = datetime.now(timezone.utc)
    idle_persisted_id = await _add_agent_session(
        db,
        title="idle persisted",
        updated_at=now - timedelta(days=31),
    )
    active_persisted_id = await _add_agent_session(
        db,
        title="active persisted",
        updated_at=now - timedelta(days=1),
    )
    idle_temporary_id = await _add_agent_session(
        db,
        title="idle temporary",
        updated_at=now - timedelta(days=31),
        expires_at=now + timedelta(hours=1),
    )

    settings = await _make_settings(db, AgentSessionRetentionSetting(max_idle_days=30))
    await AgentSessionSweeper(db, settings=settings)._sweep()

    assert await _remaining_session_ids(db) == {active_persisted_id, idle_temporary_id}
    assert idle_persisted_id not in await _remaining_session_ids(db)


async def test_count_pass_keeps_newest_sessions_per_user(
    db: DbSessionFactory,
) -> None:
    now = datetime.now(timezone.utc)
    first_user_id = await _add_user(db, "first-user", "ADMIN")
    second_user_id = await _add_user(db, "second-user", "MEMBER")

    # Four persisted sessions for the first user, newest first.
    first_user_session_ids = [
        await _add_agent_session(
            db,
            title=f"first-user session {days_ago}",
            user_id=first_user_id,
            updated_at=now - timedelta(days=days_ago),
        )
        for days_ago in (1, 2, 3, 4)
    ]
    # The first user's oldest activity is a temporary session — exempt from the cap.
    first_user_temporary_id = await _add_agent_session(
        db,
        title="first-user temporary",
        user_id=first_user_id,
        updated_at=now - timedelta(days=10),
        expires_at=now + timedelta(hours=1),
    )
    second_user_session_id = await _add_agent_session(
        db,
        title="second-user session",
        user_id=second_user_id,
        updated_at=now - timedelta(days=9),
    )
    # Sessions without a user (auth disabled) share one capped partition.
    anonymous_session_ids = [
        await _add_agent_session(
            db,
            title=f"anonymous session {days_ago}",
            updated_at=now - timedelta(days=days_ago),
        )
        for days_ago in (5, 6, 7)
    ]

    settings = await _make_settings(db, AgentSessionRetentionSetting(max_count_per_user=2))
    await AgentSessionSweeper(db, settings=settings)._sweep()

    assert await _remaining_session_ids(db) == {
        *first_user_session_ids[:2],
        first_user_temporary_id,
        second_user_session_id,
        *anonymous_session_ids[:2],
    }


async def test_all_zero_setting_runs_only_temporary_gc(
    db: DbSessionFactory,
) -> None:
    now = datetime.now(timezone.utc)
    user_id = await _add_user(db, "capped-user", "MEMBER")
    ancient_session_ids = [
        await _add_agent_session(
            db,
            title=f"ancient session {days_ago}",
            user_id=user_id,
            updated_at=now - timedelta(days=days_ago),
        )
        for days_ago in (400, 500, 600)
    ]
    expired_temporary_id = await _add_agent_session(
        db,
        title="expired temporary",
        updated_at=now - timedelta(days=2),
        expires_at=now - timedelta(hours=1),
    )

    settings = await _make_settings(
        db, AgentSessionRetentionSetting(max_idle_days=0, max_count_per_user=0)
    )
    await AgentSessionSweeper(db, settings=settings)._sweep()

    remaining_ids = await _remaining_session_ids(db)
    assert remaining_ids == set(ancient_session_ids)
    assert expired_temporary_id not in remaining_ids


async def test_setting_edits_apply_on_the_next_sweep(
    db: DbSessionFactory,
) -> None:
    now = datetime.now(timezone.utc)
    idle_session_id = await _add_agent_session(
        db,
        title="idle persisted",
        updated_at=now - timedelta(days=31),
    )

    settings = await _make_settings(db, AgentSessionRetentionSetting(max_idle_days=0))
    sweeper = AgentSessionSweeper(db, settings=settings)
    await sweeper._sweep()
    assert await _remaining_session_ids(db) == {idle_session_id}

    await settings.update_agent_session_retention(AgentSessionRetentionSetting(max_idle_days=30))
    await sweeper._sweep()
    assert await _remaining_session_ids(db) == set()

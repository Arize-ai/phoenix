import asyncio
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select

from phoenix.config import EPHEMERAL_AGENT_SESSION_TIME_TO_LIVE_HOURS
from phoenix.db import models
from phoenix.db.types.data_stream_protocol import PhoenixUIMessage
from phoenix.server.daemons.agent_session_sweeper import AgentSessionSweeper
from phoenix.server.daemons.system_settings import SystemSettings
from phoenix.server.settings.registry import (
    DEFAULT_AGENT_SESSION_MAX_COUNT_PER_USER,
    SETTINGS_REGISTRY,
    AgentSessionRetentionSetting,
)
from phoenix.server.types import DbSessionFactory
from tests.unit._helpers import _agent_session_model_kwargs, _message_uuid


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
    is_ephemeral: bool = False,
) -> int:
    async with db() as session:
        agent_session = models.AgentSession(
            **_agent_session_model_kwargs(),
            project_name="assistant_agent",
            user_id=user_id,
            title=title,
            is_ephemeral=is_ephemeral,
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
    ttl = timedelta(hours=EPHEMERAL_AGENT_SESSION_TIME_TO_LIVE_HOURS)
    async with db() as session:
        expired = models.AgentSession(
            **_agent_session_model_kwargs(),
            project_name="assistant_agent",
            user_id=None,
            title="expired",
            is_ephemeral=True,
        )
        expired.created_at = expired.updated_at = now - ttl - timedelta(hours=1)
        active = models.AgentSession(
            **_agent_session_model_kwargs(),
            project_name="assistant_agent",
            user_id=None,
            title="active",
            is_ephemeral=True,
        )
        active.created_at = active.updated_at = now - timedelta(hours=1)
        persistent = models.AgentSession(
            **_agent_session_model_kwargs(),
            project_name="assistant_agent",
            user_id=None,
            title="persistent",
            is_ephemeral=False,
        )
        persistent.created_at = persistent.updated_at = now - ttl - timedelta(hours=1)
        session.add_all((expired, active, persistent))
        await session.flush()
        expired_id = expired.id
        active_id = active.id
        persistent_id = persistent.id
        session.add(
            models.AgentSessionMessage(
                agent_session_id=expired_id,
                message=PhoenixUIMessage(id=_message_uuid("message-1"), role="user", parts=[]),
            )
        )
        session.add(
            models.AgentSessionSnapshot(
                agent_session_id=expired_id,
                bashkit_snapshot=b"shell-state",
            )
        )

    settings = await _make_settings(db)
    await AgentSessionSweeper(db, settings=settings)._delete_idle_sessions(
        is_ephemeral=True,
        max_idle=ttl,
    )

    async with db() as session:
        remaining_ids = set((await session.scalars(select(models.AgentSession.id))).all())
        # The persisted session is equally idle and equally untouched: the
        # ephemeral pass is scoped by the flag, not by idleness alone.
        assert remaining_ids == {active_id, persistent_id}
        assert expired_id not in remaining_ids
        assert (await session.scalars(select(models.AgentSessionMessage))).all() == []
        assert (await session.scalars(select(models.AgentSessionSnapshot))).all() == []


async def test_idle_pass_deletes_idle_persisted_sessions_and_spares_active_ephemeral_ones(
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
    active_ephemeral_id = await _add_agent_session(
        db,
        title="active ephemeral",
        updated_at=now - timedelta(hours=1),
        is_ephemeral=True,
    )

    settings = await _make_settings(db, AgentSessionRetentionSetting(max_idle_days=30))
    await AgentSessionSweeper(db, settings=settings)._sweep()

    assert await _remaining_session_ids(db) == {active_persisted_id, active_ephemeral_id}
    assert idle_persisted_id not in await _remaining_session_ids(db)


async def test_the_two_passes_apply_different_idle_windows_to_the_same_staleness(
    db: DbSessionFactory,
) -> None:
    """The flag chooses the window, and nothing else about a session does.

    Both sessions were last touched at the same moment; only ``is_ephemeral``
    differs, and it is what decides whether the deadline is the fixed
    ephemeral TTL or the workspace's much longer retention window.
    """
    idle_for = timedelta(hours=EPHEMERAL_AGENT_SESSION_TIME_TO_LIVE_HOURS + 1)
    updated_at = datetime.now(timezone.utc) - idle_for
    assert idle_for < timedelta(days=30), "the persisted session must be inside retention"

    ephemeral_id = await _add_agent_session(
        db,
        title="ephemeral past its ttl",
        updated_at=updated_at,
        is_ephemeral=True,
    )
    persisted_id = await _add_agent_session(
        db,
        title="persisted, same staleness",
        updated_at=updated_at,
    )

    settings = await _make_settings(db, AgentSessionRetentionSetting(max_idle_days=30))
    await AgentSessionSweeper(db, settings=settings)._sweep()

    remaining_ids = await _remaining_session_ids(db)
    assert remaining_ids == {persisted_id}
    assert ephemeral_id not in remaining_ids


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
    # The first user's most recent activity is an ephemeral session. It is exempt
    # from the cap, so it must neither be trimmed itself nor occupy one of the
    # user's two slots and push a persisted session out.
    first_user_ephemeral_id = await _add_agent_session(
        db,
        title="first-user ephemeral",
        user_id=first_user_id,
        updated_at=now - timedelta(hours=1),
        is_ephemeral=True,
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
        first_user_ephemeral_id,
        second_user_session_id,
        *anonymous_session_ids[:2],
    }


async def test_all_zero_setting_runs_only_ephemeral_gc(
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
    expired_ephemeral_id = await _add_agent_session(
        db,
        title="expired ephemeral",
        updated_at=now - timedelta(days=2),
        is_ephemeral=True,
    )

    settings = await _make_settings(
        db, AgentSessionRetentionSetting(max_idle_days=0, max_count_per_user=0)
    )
    await AgentSessionSweeper(db, settings=settings)._sweep()

    remaining_ids = await _remaining_session_ids(db)
    assert remaining_ids == set(ancient_session_ids)
    assert expired_ephemeral_id not in remaining_ids


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


async def test_default_settings_enforce_both_rules_without_admin_configuration(
    db: DbSessionFactory,
) -> None:
    """A workspace that never saves a retention setting still gets both rules.

    ``_make_settings`` with no override leaves the
    ``agent.assistant.session_retention`` row absent, which is the state every
    deployment starts in.
    """
    now = datetime.now(timezone.utc)
    user_id = await _add_user(db, "default-retention-user", "MEMBER")
    idle_session_id = await _add_agent_session(
        db,
        title="idle past the default 30 days",
        user_id=user_id,
        updated_at=now - timedelta(days=31),
    )
    recent_session_ids = [
        await _add_agent_session(
            db,
            title=f"recent session {minutes_ago}",
            user_id=user_id,
            updated_at=now - timedelta(minutes=minutes_ago),
        )
        # One more than the default per-user cap, so the oldest is trimmed.
        for minutes_ago in range(DEFAULT_AGENT_SESSION_MAX_COUNT_PER_USER + 1)
    ]

    settings = await _make_settings(db)
    assert settings.agent_session_retention.max_idle_days == 30
    assert settings.agent_session_retention.max_count_per_user == 30
    await AgentSessionSweeper(db, settings=settings)._sweep()

    remaining_ids = await _remaining_session_ids(db)
    # The idle session is gone on the idle rule, and the count cap keeps only
    # the 30 most recently active of the user's remaining sessions.
    assert idle_session_id not in remaining_ids
    assert remaining_ids == set(recent_session_ids[:DEFAULT_AGENT_SESSION_MAX_COUNT_PER_USER])


def _past_ephemeral_ttl() -> datetime:
    return datetime.now(timezone.utc) - timedelta(
        hours=EPHEMERAL_AGENT_SESSION_TIME_TO_LIVE_HOURS + 1
    )


async def test_sweeper_loop_is_idle_in_unit_test_apps(db: DbSessionFactory) -> None:
    """The suite-wide fixture leaves the loop inert: a started sweeper's task
    finishes at once and a session past its retention survives it."""
    expired_id = await _add_agent_session(
        db, title="expired", updated_at=_past_ephemeral_ttl(), is_ephemeral=True
    )
    settings = await _make_settings(db)
    sweeper = AgentSessionSweeper(db, settings=settings)
    async with sweeper:
        await asyncio.wait_for(asyncio.gather(*sweeper._tasks), timeout=1)
    assert expired_id in await _remaining_session_ids(db)


@pytest.mark.real_agent_session_sweeper
async def test_sweeper_loop_sweeps_on_start_when_opted_in(
    db: DbSessionFactory,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """With the marker the real loop runs, and its first pass reaps a session
    past its retention before the loop first sleeps."""
    expired_id = await _add_agent_session(
        db, title="expired", updated_at=_past_ephemeral_ttl(), is_ephemeral=True
    )
    first_pass_done = asyncio.Event()

    async def park(_: float) -> None:
        first_pass_done.set()
        await asyncio.Event().wait()

    monkeypatch.setattr("phoenix.server.daemons.agent_session_sweeper.sleep", park)
    settings = await _make_settings(db)
    async with AgentSessionSweeper(db, settings=settings):
        await asyncio.wait_for(first_pass_done.wait(), timeout=10)
    assert expired_id not in await _remaining_session_ids(db)

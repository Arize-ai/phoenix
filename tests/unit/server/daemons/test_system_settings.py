"""Tests for system-wide settings store and agent trace recording policy."""

from __future__ import annotations

import pytest

from phoenix.db import models
from phoenix.server.daemons.system_settings import SystemSettings
from phoenix.server.settings.registry import (
    SETTINGS_REGISTRY,
    AgentSessionRetentionSetting,
    AgentTraceRecordingSetting,
)
from phoenix.server.types import DbSessionFactory


@pytest.mark.asyncio
async def test_update_agent_trace_recording_persists_and_updates_cache(
    db: DbSessionFactory,
) -> None:
    settings = SystemSettings(db=db, registry=SETTINGS_REGISTRY)
    await settings.bootstrap()
    default = AgentTraceRecordingSetting()

    # Flip the flags to test the update
    allow_local = not default.allow_local_traces
    allow_remote = not default.allow_remote_export
    await settings.update_agent_trace_recording(
        AgentTraceRecordingSetting(
            allow_local_traces=allow_local, allow_remote_export=allow_remote
        ),
        user_id=None,
    )
    assert settings.agent_trace_recording.allow_local_traces is allow_local
    assert settings.agent_trace_recording.allow_remote_export is allow_remote

    expected = {
        "allow_local_traces": allow_local,
        "allow_remote_export": allow_remote,
    }
    async with db() as session:
        row = await session.get(models.SystemSetting, "agent.assistant.trace_recording")
        assert row is not None
        assert row.value == expected


@pytest.mark.asyncio
async def test_agent_session_retention_defaults_when_unset(
    db: DbSessionFactory,
) -> None:
    settings = SystemSettings(db=db, registry=SETTINGS_REGISTRY)
    await settings.bootstrap()
    retention = settings.agent_session_retention
    assert retention.max_idle_days == 0
    assert retention.max_count_per_user == 0


@pytest.mark.asyncio
async def test_update_agent_session_retention_persists_and_updates_cache(
    db: DbSessionFactory,
) -> None:
    settings = SystemSettings(db=db, registry=SETTINGS_REGISTRY)
    await settings.bootstrap()

    await settings.update_agent_session_retention(
        AgentSessionRetentionSetting(max_idle_days=7.5, max_count_per_user=200),
        user_id=None,
    )
    assert settings.agent_session_retention.max_idle_days == 7.5
    assert settings.agent_session_retention.max_count_per_user == 200

    async with db() as session:
        row = await session.get(models.SystemSetting, "agent.assistant.session_retention")
        assert row is not None
        assert row.value == {"max_idle_days": 7.5, "max_count_per_user": 200}


def test_agent_session_retention_setting_rejects_negative_values() -> None:
    with pytest.raises(ValueError):
        AgentSessionRetentionSetting(max_idle_days=-1)
    with pytest.raises(ValueError):
        AgentSessionRetentionSetting(max_count_per_user=-1)

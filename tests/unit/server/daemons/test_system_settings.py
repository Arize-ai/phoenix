"""Tests for system-wide settings store and agent trace recording policy."""

from __future__ import annotations

import pytest

from phoenix.db import models
from phoenix.server.daemons.system_settings import SystemSettings
from phoenix.server.settings.registry import SETTINGS_REGISTRY, AgentTraceRecordingSetting
from phoenix.server.types import DbSessionFactory


@pytest.mark.asyncio
async def test_update_agent_trace_recording_persists_and_updates_cache(
    db: DbSessionFactory,
) -> None:
    ss = SystemSettings(db=db, registry=SETTINGS_REGISTRY)
    await ss.bootstrap()
    default = AgentTraceRecordingSetting()

    # Flip the flags to test the update
    allow_local = not default.allow_local_traces
    allow_remote = not default.allow_remote_export
    await ss.update_agent_trace_recording(
        AgentTraceRecordingSetting(
            allow_local_traces=allow_local, allow_remote_export=allow_remote
        ),
        user_id=None,
    )
    assert ss.agent_trace_recording.allow_local_traces is allow_local
    assert ss.agent_trace_recording.allow_remote_export is allow_remote

    expected = {
        "allow_local_traces": allow_local,
        "allow_remote_export": allow_remote,
    }
    async with db() as session:
        row = await session.get(models.SystemSetting, "agent.assistant.trace_recording")
        assert row is not None
        assert row.value == expected

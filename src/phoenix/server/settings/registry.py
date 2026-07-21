from __future__ import annotations

from types import MappingProxyType
from typing import Mapping

from pydantic import BaseModel, ConfigDict, Field

from phoenix.db.models import SystemSettingKey


class AgentTraceRecordingSetting(BaseModel):
    """Server-side ceiling for assistant trace recording flags."""

    model_config = ConfigDict(extra="forbid", frozen=True, validate_assignment=True)

    allow_local_traces: bool = Field(default=False)
    allow_remote_export: bool = Field(default=False)


class AgentAssistantEnabledSetting(BaseModel):
    """Whether the agent assistant feature (the /chat endpoint) is enabled at runtime.

    Defaults to ``True`` so deployments without PHOENIX_DISABLE_AGENT_ASSISTANT
    set get a working assistant out of the box. The env var is the deploy-time
    ceiling; this setting is the admin-runtime knob below it. Admins can flip
    it to ``False`` from the UI to kill the feature for the whole workspace
    without redeploying.
    """

    model_config = ConfigDict(extra="forbid", frozen=True, validate_assignment=True)

    enabled: bool = Field(default=True)


class AgentSessionRetentionSetting(BaseModel):
    """Workspace-wide retention for persisted (non-temporary) agent sessions.

    Temporary sessions are governed by their own ``expires_at`` TTL and are
    never touched by retention. Either dimension can be turned off with ``0``:
    ``max_idle_days=0`` means sessions are never deleted for idleness, and
    ``max_count_per_user=0`` means no per-user count cap.
    """

    model_config = ConfigDict(extra="forbid", frozen=True, validate_assignment=True)

    max_idle_days: float = Field(default=30, ge=0)
    max_count_per_user: int = Field(default=0, ge=0)


SETTINGS_REGISTRY: Mapping[SystemSettingKey, type[BaseModel]] = MappingProxyType(
    {
        "agent.assistant.trace_recording": AgentTraceRecordingSetting,
        "agent.assistant.enabled": AgentAssistantEnabledSetting,
        "agent.assistant.session_retention": AgentSessionRetentionSetting,
    }
)

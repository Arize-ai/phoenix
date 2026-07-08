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


SETTINGS_REGISTRY: Mapping[SystemSettingKey, type[BaseModel]] = MappingProxyType(
    {
        "agent.assistant.trace_recording": AgentTraceRecordingSetting,
        "agent.assistant.enabled": AgentAssistantEnabledSetting,
    }
)

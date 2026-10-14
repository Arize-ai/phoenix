from __future__ import annotations

from types import MappingProxyType
from typing import Literal, Mapping, Optional

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field

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


class AgentGitHubSetting(BaseModel):
    """Whether the PXI GitHub tools (backed by GitHub's MCP server) are enabled at runtime.

    Defaults to ``True`` so the capability works out of the box once a token is
    configured — without any token it is inert, so the default grants nothing
    by itself. The PHOENIX_AGENTS_DISABLE_GITHUB env var is the deploy-time
    ceiling; this setting is the admin-runtime knob below it. Disabling never
    deletes stored tokens; it makes them unusable until re-enabled.
    """

    model_config = ConfigDict(extra="forbid", frozen=True, validate_assignment=True)

    enabled: bool = Field(default=True)


DEFAULT_AGENT_SESSION_MAX_IDLE_DAYS = 30
DEFAULT_AGENT_SESSION_MAX_COUNT_PER_USER = 30


class AgentSessionRetentionSetting(BaseModel):
    """Workspace-wide retention for non-ephemeral agent sessions."""

    model_config = ConfigDict(extra="forbid", frozen=True, validate_assignment=True)

    max_idle_days: int = Field(default=DEFAULT_AGENT_SESSION_MAX_IDLE_DAYS, ge=0)
    max_count_per_user: int = Field(default=DEFAULT_AGENT_SESSION_MAX_COUNT_PER_USER, ge=0)


ManifestSource = Literal["bundled", "remote"]


class ModelCostManifestVersionSetting(BaseModel):
    """Which model cost manifest the built-in models and token prices were last synced from.

    Written by the server, not by admins: the bundled manifest is applied at boot and a
    fetched one at runtime, each only if it is newer than the one recorded here.
    """

    # Unknown fields are ignored so that replicas running an older Phoenix can still read a
    # marker written by a newer one.
    model_config = ConfigDict(extra="ignore", frozen=True)

    schema_version: int
    generated_at: AwareDatetime
    source: ManifestSource
    url: Optional[str] = None
    applied_at: AwareDatetime


SETTINGS_REGISTRY: Mapping[SystemSettingKey, type[BaseModel]] = MappingProxyType(
    {
        "agent.assistant.trace_recording": AgentTraceRecordingSetting,
        "agent.assistant.enabled": AgentAssistantEnabledSetting,
        "agent.assistant.session_retention": AgentSessionRetentionSetting,
        "agent.assistant.github": AgentGitHubSetting,
        "cost_tracking.model_cost_manifest": ModelCostManifestVersionSetting,
    }
)


# Keys stored in the system_state table, which the server writes itself (unlike
# system_settings, which admins edit). Each key maps to the model its value must parse as.
STATE_REGISTRY: Mapping[str, type[BaseModel]] = MappingProxyType({})

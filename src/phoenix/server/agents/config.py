"""Effective server-side assistant configuration.

The ``PHOENIX_AGENTS_*`` environment variables are the deploy-time ceiling; the
database-backed system settings are the admin-runtime knob below it. The GraphQL
``agentsConfig`` resolver and the `phoenix serve` launch banner both derive the
effective configuration from here so the two can never disagree.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from phoenix.config import (
    get_env_phoenix_agents_assistant_project_name,
    get_env_phoenix_agents_collector_api_key,
    get_env_phoenix_agents_collector_endpoint,
    get_env_phoenix_agents_disable_bash,
    get_env_phoenix_agents_force_tracing,
    get_env_phoenix_agents_github_enabled,
    get_env_phoenix_agents_web_access_enabled,
)
from phoenix.server.settings.registry import AgentGitHubSetting, AgentTraceRecordingSetting


@dataclass(frozen=True)
class AgentsEnvConfig:
    """Assistant configuration sourced from the environment.

    `phoenix serve` builds this eagerly at process start so a malformed
    ``PHOENIX_AGENTS_*`` value fails before the server takes on any side effects.
    """

    assistant_project_name: str
    collector_endpoint: Optional[str]
    collector_api_key_configured: bool
    force_tracing: bool
    web_access_enabled: bool
    server_bash_enabled: bool
    github_enabled: bool

    @classmethod
    def from_env(cls) -> AgentsEnvConfig:
        return cls(
            assistant_project_name=get_env_phoenix_agents_assistant_project_name(),
            collector_endpoint=get_env_phoenix_agents_collector_endpoint(),
            collector_api_key_configured=bool(get_env_phoenix_agents_collector_api_key()),
            force_tracing=get_env_phoenix_agents_force_tracing(),
            web_access_enabled=get_env_phoenix_agents_web_access_enabled(),
            server_bash_enabled=not get_env_phoenix_agents_disable_bash(),
            github_enabled=get_env_phoenix_agents_github_enabled(),
        )

    def allows_local_traces(self, trace_recording: AgentTraceRecordingSetting) -> bool:
        """Whether users may record assistant traces locally, given the admin ceiling."""
        return self.force_tracing or trace_recording.allow_local_traces

    def allows_remote_export(self, trace_recording: AgentTraceRecordingSetting) -> bool:
        """Whether users may export assistant traces to the collector, given the admin ceiling."""
        return self.force_tracing or trace_recording.allow_remote_export

    def allows_github(self, github: AgentGitHubSetting) -> bool:
        """Whether the PXI GitHub tools are effectively enabled: the env ceiling
        allows them and the admin has turned them on."""
        return self.github_enabled and github.enabled

from __future__ import annotations

from dataclasses import dataclass

from pydantic_ai.capabilities import AbstractCapability
from pydantic_ai.models.anthropic import AnthropicModelSettings

from phoenix.server.agents.types import AgentDependencies


@dataclass
class AnthropicPromptCacheCapability(AbstractCapability[AgentDependencies]):
    """Enable Anthropic prompt caching."""

    def get_model_settings(self) -> AnthropicModelSettings:
        return AnthropicModelSettings(
            anthropic_cache=True,
            anthropic_cache_tool_definitions=True,
            anthropic_cache_instructions=True,
        )

from __future__ import annotations

from dataclasses import dataclass

from pydantic_ai.capabilities import AbstractCapability
from pydantic_ai.models.anthropic import AnthropicModelSettings

from phoenix.server.agents.types import AgentDependencies


@dataclass
class AnthropicPromptCacheCapability(AbstractCapability[AgentDependencies]):
    """Enable Anthropic prompt caching across the conversation prefix, tool
    definitions, and the static→dynamic instruction boundary.

    pydantic-ai sorts instruction parts static-before-dynamic regardless of
    provider, so OpenAI's automatic prefix caching kicks in on the stable
    static portion for free; Anthropic additionally needs explicit
    ``cache_control`` markers, which this capability contributes via:

    - ``anthropic_cache=True`` — top-level automatic breakpoint that
      pydantic-ai moves forward as the conversation grows.
    - ``anthropic_cache_tool_definitions=True`` — marker on the last tool
      definition so the tools block joins the cached prefix.
    - ``anthropic_cache_instructions=True`` — marker at the end of the
      static system-prompt blocks.

    Mount only when the model is Anthropic.
    """

    def get_model_settings(self) -> AnthropicModelSettings:
        return AnthropicModelSettings(
            anthropic_cache=True,
            anthropic_cache_tool_definitions=True,
            anthropic_cache_instructions=True,
        )

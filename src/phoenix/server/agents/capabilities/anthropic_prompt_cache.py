from __future__ import annotations

from dataclasses import dataclass

from pydantic_ai.capabilities import AbstractCapability
from pydantic_ai.models import Model
from pydantic_ai.models.anthropic import AnthropicModelSettings
from pydantic_ai.tools import AgentDepsT


@dataclass
class AnthropicPromptCacheCapability(AbstractCapability[AgentDepsT]):
    """Attach Anthropic ``cache_control`` markers; Anthropic needs them
    explicitly, whereas OpenAI/Google prefix-cache automatically."""

    def get_model_settings(self) -> AnthropicModelSettings:
        return AnthropicModelSettings(
            anthropic_cache=True,
            anthropic_cache_tool_definitions=True,
            anthropic_cache_instructions=True,
        )


def build_anthropic_prompt_cache_capability(
    model: Model,
) -> AnthropicPromptCacheCapability[object] | None:
    """Return the Anthropic prompt-cache capability if ``model`` is Anthropic."""
    if model.system != "anthropic":
        return None
    return AnthropicPromptCacheCapability[object]()

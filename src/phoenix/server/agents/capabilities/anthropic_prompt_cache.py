from __future__ import annotations

from dataclasses import dataclass

from pydantic_ai.capabilities import AbstractCapability
from pydantic_ai.models import Model
from pydantic_ai.models.anthropic import AnthropicModel, AnthropicModelSettings
from pydantic_ai.models.wrapper import WrapperModel
from pydantic_ai.tools import AgentDepsT


@dataclass
class AnthropicPromptCacheCapability(AbstractCapability[AgentDepsT]):
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

    Mount via ``build_anthropic_prompt_cache_capability``.
    """

    def get_model_settings(self) -> AnthropicModelSettings:
        return AnthropicModelSettings(
            anthropic_cache=True,
            anthropic_cache_tool_definitions=True,
            anthropic_cache_instructions=True,
        )


def _unwrap_model(model: Model) -> Model:
    """Peel ``WrapperModel`` layers (``build_model`` always wraps) to reach the
    provider model; ``isinstance`` does not see through ``__getattr__``."""
    while isinstance(model, WrapperModel):
        model = model.wrapped
    return model


def build_anthropic_prompt_cache_capability(
    model: Model,
) -> AnthropicPromptCacheCapability[object] | None:
    """Return the Anthropic prompt-cache capability if ``model`` is Anthropic."""
    if not isinstance(_unwrap_model(model), AnthropicModel):
        return None
    return AnthropicPromptCacheCapability[object]()

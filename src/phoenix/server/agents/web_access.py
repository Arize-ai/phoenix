from __future__ import annotations

from pydantic_ai.capabilities import WebFetch, WebSearch
from pydantic_ai.models import Model
from pydantic_ai.native_tools import WebFetchTool, WebSearchTool

from phoenix.server.agents.types import AgentDependencies


def build_web_search_capability(model: Model) -> WebSearch[AgentDependencies] | None:
    """Return a provider-native web search capability if the model supports it."""
    if WebSearchTool not in model.profile.supported_native_tools:
        return None
    return WebSearch(native=True, local=False)


def build_web_fetch_capability(model: Model) -> WebFetch[AgentDependencies] | None:
    """Return a provider-native web fetch capability if the model supports it."""
    if WebFetchTool not in model.profile.supported_native_tools:
        return None
    return WebFetch(native=True, local=False)

from __future__ import annotations

from pydantic_ai.capabilities import WebFetch, WebSearch
from pydantic_ai.models import Model
from pydantic_ai.native_tools import AbstractNativeTool, WebFetchTool, WebSearchTool


def _get_supported_native_tools(model: Model) -> frozenset[type[AbstractNativeTool]]:
    return model.profile.get("supported_native_tools", frozenset())


def build_web_search_capability(model: Model) -> WebSearch[object] | None:
    """Return a provider-native web search capability if the model supports it."""
    if WebSearchTool not in _get_supported_native_tools(model):
        return None
    return WebSearch(native=True, local=False)


def build_web_fetch_capability(model: Model) -> WebFetch[object] | None:
    """Return a provider-native web fetch capability if the model supports it."""
    if WebFetchTool not in _get_supported_native_tools(model):
        return None
    return WebFetch(native=True, local=False)

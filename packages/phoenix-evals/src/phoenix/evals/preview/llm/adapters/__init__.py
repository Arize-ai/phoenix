"""Adapters for different LLM SDKs and providers."""

# ruff: noqa: I001
# customizing the import order to prioritize the openai adapter over the others
from .openai import OpenAIAdapter
from .langchain import LangChainModelAdapter
from .litellm import LiteLLMAdapter

__all__ = [
    "LangChainModelAdapter",
    "LiteLLMAdapter",
    "OpenAIAdapter",
]


def register_adapters() -> None:
    """Imports and registers all adapters"""
    pass

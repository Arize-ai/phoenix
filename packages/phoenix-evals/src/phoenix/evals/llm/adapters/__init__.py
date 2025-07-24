"""Adapters for different LLM SDKs and providers."""

from .langchain import LangChainModelAdapter
from .litellm import LiteLLMAdapter
from .openai import OpenAIAdapter

__all__ = [
    "LangChainModelAdapter",
    "LiteLLMAdapter",
    "OpenAIAdapter",
]


def register_adapters() -> None:
    """Imports and registers all adapters"""
    pass

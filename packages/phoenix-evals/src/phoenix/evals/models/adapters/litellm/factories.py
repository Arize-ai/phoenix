"""
Factory functions for creating LiteLLM clients.
"""

from typing import Any

from .client import LiteLLMClient


def create_anthropic_client(model: str, **kwargs: Any) -> LiteLLMClient:
    """Factory function to create Anthropic LiteLLM clients."""
    return LiteLLMClient(provider="anthropic", model=model, **kwargs)


def create_openai_client(model: str, **kwargs: Any) -> LiteLLMClient:
    """Factory function to create OpenAI LiteLLM clients."""
    return LiteLLMClient(provider="openai", model=model, **kwargs)


def create_litellm_client(model: str, **kwargs: Any) -> LiteLLMClient:
    """Factory function to create generic LiteLLM clients."""
    # For generic litellm provider, assume model is already in provider/model format
    return LiteLLMClient(provider="litellm", model=model, **kwargs)

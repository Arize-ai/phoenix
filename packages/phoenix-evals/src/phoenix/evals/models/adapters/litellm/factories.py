"""
Factory functions for creating LiteLLM clients.
"""

from typing import Any
from .client import LiteLLMClient


def _create_cohere_client(model: str, **kwargs: Any) -> LiteLLMClient:
    """Factory function to create Cohere LiteLLM clients."""
    return LiteLLMClient(provider="cohere", model=model, **kwargs)


def _create_groq_client(model: str, **kwargs: Any) -> LiteLLMClient:
    """Factory function to create Groq LiteLLM clients."""
    return LiteLLMClient(provider="groq", model=model, **kwargs)


def _create_together_client(model: str, **kwargs: Any) -> LiteLLMClient:
    """Factory function to create Together AI LiteLLM clients."""
    return LiteLLMClient(provider="together_ai", model=model, **kwargs)


def _create_litellm_client(model: str, **kwargs: Any) -> LiteLLMClient:
    """Factory function to create generic LiteLLM clients."""
    # For generic litellm provider, assume model is already in provider/model format
    return LiteLLMClient(provider="litellm", model=model, **kwargs)

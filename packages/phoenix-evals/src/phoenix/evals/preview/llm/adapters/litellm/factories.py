from typing import Any

from .client import LiteLLMClient


def create_anthropic_client(model: str, is_async: bool, **kwargs: Any) -> LiteLLMClient:
    return LiteLLMClient(provider="anthropic", model=model, **kwargs)


def create_openai_client(model: str, is_async: bool, **kwargs: Any) -> LiteLLMClient:
    return LiteLLMClient(provider="openai", model=model, **kwargs)


def create_litellm_client(model: str, is_async: bool, **kwargs: Any) -> LiteLLMClient:
    return LiteLLMClient(provider="litellm", model=model, **kwargs)

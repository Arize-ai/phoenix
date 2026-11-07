"""Adapters for different decision-model SDKs and providers."""

from .openai import OpenAIDecisionAdapter
from .typesafe import TypeSafeDecisionAdapter

__all__ = [
    "OpenAIDecisionAdapter",
    "TypeSafeDecisionAdapter",
]


def register_adapters() -> None:
    """Imports and registers all decision adapters."""
    pass

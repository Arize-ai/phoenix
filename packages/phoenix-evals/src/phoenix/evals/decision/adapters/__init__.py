"""Adapters for different decision-model SDKs and providers."""

from .typesafe import TypeSafeDecisionAdapter

__all__ = [
    "TypeSafeDecisionAdapter",
]


def register_adapters() -> None:
    """Imports and registers all decision adapters."""
    pass

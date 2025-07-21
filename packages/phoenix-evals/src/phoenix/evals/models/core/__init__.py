"""Core components for the Universal LLM Wrapper system."""

from .base import BaseLLMAdapter
from .registries import AdapterRegistry, ProviderRegistry, register_adapter, register_provider
from .types import (
    AdapterRegistration,
    ProviderRegistration,
)

__all__ = [
    "AdapterRegistry",
    "ProviderRegistry",
    "register_adapter",
    "register_provider",
    "AdapterRegistration",
    "ProviderRegistration",
    "BaseLLMAdapter",
]

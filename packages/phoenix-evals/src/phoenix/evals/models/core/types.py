"""
Data structures and types for the Universal LLM Wrapper system.
"""

from dataclasses import dataclass
from typing import TYPE_CHECKING, Any, Callable, List, Type

if TYPE_CHECKING:
    from .base import BaseLLMAdapter


@dataclass
class AdapterRegistration:
    """Registration information for an adapter."""

    adapter_class: Type["BaseLLMAdapter"]
    identifier: Callable[[Any], bool]
    priority: int
    name: str


@dataclass
class ProviderRegistration:
    """Registration information for a provider."""

    provider: str
    adapter_class: Type["BaseLLMAdapter"]
    client_factory: Callable[..., Any]
    dependencies: List[str]

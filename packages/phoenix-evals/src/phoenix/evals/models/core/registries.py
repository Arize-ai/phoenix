"""
Registry system for adapters and providers in the Universal LLM Wrapper.
"""

import logging
import threading
from typing import Any, Callable, Dict, List, Optional, Tuple, Type, TYPE_CHECKING

from .types import AdapterRegistration, ProviderRegistration

if TYPE_CHECKING:
    from .base import BaseLLMAdapter

logger = logging.getLogger(__name__)


class AdapterRegistry:
    """Thread-safe registry for LLM adapters with client detection."""

    def __init__(self):
        self._adapters: List[AdapterRegistration] = []
        self._lock = threading.RLock()

    def register_adapter(
        self,
        adapter_class: Type["BaseLLMAdapter"],
        identifier: Callable[[Any], bool],
        priority: int = 10,
        name: str = "",
    ) -> None:
        """Register an adapter with its identification function."""
        with self._lock:
            if not name:
                name = adapter_class.__name__

            registration = AdapterRegistration(
                adapter_class=adapter_class,
                identifier=identifier,
                priority=priority,
                name=name,
            )

            self._adapters.append(registration)
            # Sort by priority (higher priority first)
            self._adapters.sort(key=lambda x: x.priority, reverse=True)

    def find_adapter(self, client: Any) -> Optional[Type["BaseLLMAdapter"]]:
        """Find the best matching adapter for the given client."""
        with self._lock:
            for registration in self._adapters:
                try:
                    if registration.identifier(client):
                        logger.debug(
                            f"Selected adapter '{registration.name}' for client {type(client)}"
                        )
                        return registration.adapter_class
                except Exception as e:
                    logger.debug(f"Adapter '{registration.name}' identification failed: {e}")
                    continue
            return None

    def list_adapters(self) -> List[Tuple[str, int]]:
        """List all registered adapters with their priorities."""
        with self._lock:
            return [(reg.name, reg.priority) for reg in self._adapters]


class ProviderRegistry:
    """Thread-safe registry for provider-based client instantiation."""

    def __init__(self):
        self._providers: Dict[str, List[ProviderRegistration]] = {}
        self._lock = threading.RLock()

    def register_provider(
        self,
        provider: str,
        adapter_class: Type["BaseLLMAdapter"],
        client_factory: Callable[..., Any],
        dependencies: Optional[List[str]] = None,
    ) -> None:
        """Register a provider with its client factory and target adapter."""
        with self._lock:
            registration = ProviderRegistration(
                provider=provider,
                adapter_class=adapter_class,
                client_factory=client_factory,
                dependencies=dependencies or [],
            )

            # Check dependencies at registration time
            try:
                self._check_dependencies(registration)
            except ImportError as e:
                logger.debug(f"Skipping provider '{provider}' registration: {e}")
                return  # Don't register if dependencies are missing

            if provider not in self._providers:
                self._providers[provider] = []

            self._providers[provider].append(registration)

    def create_client(self, provider: str, model: str, **kwargs) -> Any:
        """Create a client for the specified provider and model."""
        with self._lock:
            provider_registrations = self._providers.get(provider)
            if not provider_registrations:
                available_providers = list(self._providers.keys())
                raise ValueError(
                    f"Unknown provider '{provider}'. Available providers: {available_providers}"
                )

            # Use the first available registration (could be enhanced with selection logic)
            registration = provider_registrations[0]

            # Dependencies were already checked at registration time, so we can proceed directly
            # Create client using factory
            try:
                return registration.client_factory(model=model, **kwargs)
            except Exception as e:
                raise RuntimeError(
                    f"Failed to create client for provider '{provider}' with model '{model}': {e}"
                ) from e

    def _check_dependencies(self, registration: ProviderRegistration) -> None:
        """Check if all required dependencies are available."""
        if not registration.dependencies:
            return

        missing_deps = []
        for dep in registration.dependencies:
            try:
                __import__(dep)
            except ImportError:
                missing_deps.append(dep)

        if missing_deps:
            deps_str = ", ".join(missing_deps)
            raise ImportError(
                f"Missing required dependencies for provider '{registration.provider}': {deps_str}. "
                f"Please install them with: pip install {' '.join(missing_deps)}"
            )

    def list_providers(self) -> List[str]:
        """List all available providers."""
        with self._lock:
            return list(self._providers.keys())

    def get_provider_registrations(self, provider: str) -> List[ProviderRegistration]:
        """Get all registrations for a specific provider."""
        with self._lock:
            return self._providers.get(provider, [])


# Global registry instances
_adapter_registry = AdapterRegistry()
_provider_registry = ProviderRegistry()


def register_adapter(
    identifier: Callable[[Any], bool],
    priority: int = 10,
    name: str = "",
) -> Callable[[Type["BaseLLMAdapter"]], Type["BaseLLMAdapter"]]:
    """
    Decorator to register an adapter in the global registry.

    Args:
        identifier: Function that returns True if the client is compatible with this adapter
        priority: Priority for adapter selection (higher = checked first)
        name: Optional name for the adapter (defaults to class name)

    Example:
        @register_adapter(
            identifier=lambda client: "langchain" in client.__module__,
            priority=10,
            name="langchain"
        )
        class LangChainModelAdapter(BaseLLMAdapter):
            pass
    """

    def decorator(adapter_class: Type["BaseLLMAdapter"]) -> Type["BaseLLMAdapter"]:
        _adapter_registry.register_adapter(adapter_class, identifier, priority, name)
        return adapter_class

    return decorator


def register_provider(
    provider: str,
    client_factory: Callable[..., Any],
    dependencies: Optional[List[str]] = None,
) -> Callable[[Type["BaseLLMAdapter"]], Type["BaseLLMAdapter"]]:
    """
    Decorator to register a provider with an adapter.

    Args:
        provider: Provider name (e.g., "openai", "anthropic")
        client_factory: Factory function to create clients for this provider
        dependencies: Optional list of required packages

    Example:
        @register_provider(
            provider="openai",
            client_factory=_create_openai_langchain_client,
            dependencies=["langchain", "langchain-openai"]
        )
        class LangChainModelAdapter(BaseLLMAdapter):
            pass
    """

    def decorator(adapter_class: Type["BaseLLMAdapter"]) -> Type["BaseLLMAdapter"]:
        _provider_registry.register_provider(provider, adapter_class, client_factory, dependencies)
        return adapter_class

    return decorator

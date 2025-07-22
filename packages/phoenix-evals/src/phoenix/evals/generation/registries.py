import logging
from typing import Any, Callable, List, Optional, Type

from .types import AdapterRegistration, BaseLLMAdapter, ProviderRegistration

logger = logging.getLogger(__name__)


class AdapterRegistry:
    def __init__(self) -> None:
        self._adapters: List[AdapterRegistration] = []

    def register_adapter(
        self,
        adapter_class: Type["BaseLLMAdapter"],
        identifier: Callable[[Any], bool],
        name: str = "",
    ) -> None:
        """Register an adapter with its identification function."""
        if not name:
            name = adapter_class.__name__

        registration = AdapterRegistration(
            adapter_class=adapter_class,
            identifier=identifier,
            name=name,
        )

        self._adapters.append(registration)

    def find_adapter(self, client: Any) -> Optional[Type["BaseLLMAdapter"]]:
        """Find the best matching adapter for the given client."""
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


class ProviderRegistry:
    def __init__(self) -> None:
        self._providers: Dict[str, List[ProviderRegistration]] = {}
        self._disabled_providers: List[ProviderRegistration] = []

    def register_provider(
        self,
        provider: str,
        adapter_class: Type["BaseLLMAdapter"],
        client_factory: Callable[..., Any],
        dependencies: Optional[List[str]] = None,
    ) -> None:
        registration = ProviderRegistration(
            provider=provider,
            adapter_class=adapter_class,
            client_factory=client_factory,
            dependencies=dependencies or [],
        )

        try:
            self._check_dependencies(registration)
        except ImportError:
            self._disabled_providers.append(registration)
            return

        if provider not in self._providers:
            self._providers[provider] = []
        self._providers[provider].append(registration)

    def create_client(self, provider: str, model: str, **kwargs: Any) -> Any:
        """Create a client for the specified provider and model."""
        provider_registrations = self._providers.get(provider)
        if not provider_registrations:
            available_providers = list(self._providers.keys())
            raise ValueError(
                f"Unknown provider '{provider}'. Available providers: {available_providers}"
            )

        registration = provider_registrations[0]

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

        for dep in registration.dependencies:
            __import__(dep)

    def list_providers(self) -> List[str]:
        """List all available providers."""
        return list(self._providers.keys())

    def get_provider_registrations(self, provider: str) -> List[ProviderRegistration]:
        """Get all registrations for a specific provider."""
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

import logging
from typing import Any, Callable, Dict, List, Optional, Type, TypedDict

from .types import AdapterRegistration, BaseLLMAdapter, ProviderRegistration

logger = logging.getLogger(__name__)

# ANSI color codes for terminal output
class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    RESET = '\033[0m'
    BOLD = '\033[1m'


class ProviderInfo(TypedDict):
    provider: str
    adapter: str
    dependencies: List[str]
    status: str
    is_enabled: bool


class AdapterInfo(TypedDict):
    name: str
    adapter: str
    description: str


class SingletonMeta(type):
    _instances: dict[Any, Any] = dict()

    def __call__(cls, *args: Any, **kwargs: Any) -> Any:
        if cls not in cls._instances:
            cls._instances[cls] = super(SingletonMeta, cls).__call__(*args, **kwargs)
        return cls._instances[cls]


class AdapterRegistry(metaclass=SingletonMeta):
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

    def list_adapters(self) -> List[str]:
        """List all available adapter names."""
        return [registration.name for registration in self._adapters]


class ProviderRegistry(metaclass=SingletonMeta):
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
ADAPTER_REGISTRY = AdapterRegistry()
PROVIDER_REGISTRY = ProviderRegistry()


def adapter_availability_table() -> str:
    """Return a consolidated table of LLM providers and adapters with color-coded status."""
    output = ["\n" + "=" * 80]
    output.append("PHOENIX LLM WRAPPER - PROVIDERS & ADAPTERS")
    output.append("=" * 80)

    all_providers: List[ProviderInfo] = []

    for provider_name, registrations in PROVIDER_REGISTRY._providers.items():
        for reg in registrations:
            enabled_provider: ProviderInfo = {
                "provider": provider_name,
                "adapter": reg.adapter_class.__name__,
                "dependencies": reg.dependencies,
                "status": "✓ Available",
                "is_enabled": True,
            }
            all_providers.append(enabled_provider)

    for reg in PROVIDER_REGISTRY._disabled_providers:
        disabled_provider: ProviderInfo = {
            "provider": reg.provider,
            "adapter": reg.adapter_class.__name__,
            "dependencies": reg.dependencies,
            "status": "✗ Disabled ",
            "is_enabled": False,
        }
        all_providers.append(disabled_provider)

    if all_providers:
        output.append("\n📦 PROVIDERS")
        output.append("-" * 60)
        output.append(_get_consolidated_provider_table(all_providers))
    else:
        output.append("\n📦 PROVIDERS: None")

    return "\n".join(output)


def _get_consolidated_provider_table(providers: List[ProviderInfo]) -> str:
    """Return a consolidated table of all providers with color-coded status."""
    if not providers:
        return ""

    max_provider = max(len(p["provider"]) for p in providers)
    max_adapter = max(len(p["adapter"]) for p in providers)
    max_deps = max(len(", ".join(p["dependencies"])) for p in providers)
    max_status = max(len(p["status"]) for p in providers)

    provider_width = max(max_provider, 8)
    adapter_width = max(max_adapter, 7)
    deps_width = max(max_deps, 12)
    status_width = max(max_status, 6)

    header = (
        f"{'Provider':<{provider_width}} | {'Status':<{status_width}} | "
        f"{'Adapter':<{adapter_width}} | {'Dependencies':<{deps_width}}"
    )

    output = [header, "-" * len(header)]

    for p in providers:
        deps_str = ", ".join(p["dependencies"]) if p["dependencies"] else "None"

        if p["is_enabled"]:
            status_colored = f"{Colors.GREEN}{p['status']:<{status_width}}{Colors.RESET}"
        else:
            status_colored = f"{Colors.RED}{p['status']:<{status_width}}{Colors.RESET}"

        row = (
            f"{p['provider']:<{provider_width}} | {status_colored} | "
            f"{p['adapter']:<{adapter_width}} | {deps_str:<{deps_width}}"
        )
        output.append(row)

    return "\n".join(output)


def register_adapter(
    identifier: Callable[[Any], bool],
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
            name="langchain"
        )
        class LangChainModelAdapter(BaseLLMAdapter):
            pass
    """

    def decorator(adapter_class: Type["BaseLLMAdapter"]) -> Type["BaseLLMAdapter"]:
        ADAPTER_REGISTRY.register_adapter(adapter_class, identifier, name)
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
        PROVIDER_REGISTRY.register_provider(provider, adapter_class, client_factory, dependencies)
        return adapter_class

    return decorator

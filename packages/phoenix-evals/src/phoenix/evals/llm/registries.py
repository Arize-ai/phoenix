import logging
from importlib.metadata import PackageNotFoundError, version
from typing import Any, Callable, Dict, List, Optional, Tuple, Type, TypedDict

from phoenix.evals.utils import emoji_guard

from .types import AdapterRegistration, BaseLLMAdapter, ProviderRegistration

logger = logging.getLogger(__name__)


# ANSI color codes for terminal output
class Colors:
    GREEN = "\033[92m"
    RED = "\033[91m"
    RESET = "\033[0m"
    BOLD = "\033[1m"


class ProviderInfo(TypedDict):
    provider: str
    client: str
    dependencies: List[str]
    status: str
    is_enabled: bool


class SingletonMeta(type):
    def __init__(cls, name: str, bases: Tuple[type, ...], attrs: Dict[str, Any]) -> None:
        super().__init__(name, bases, attrs)
        cls._instances: dict[Any, Any] = {}

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
        get_rate_limit_errors: Optional[Callable[..., List[Type[Exception]]]] = None,
        dependencies: Optional[List[str]] = None,
    ) -> None:
        registration = ProviderRegistration(
            provider=provider,
            adapter_class=adapter_class,
            client_factory=client_factory,
            get_rate_limit_errors=get_rate_limit_errors,
            dependencies=dependencies or [],
            client_name=adapter_class.client_name(),
        )

        try:
            self._check_dependencies(registration)
        except PackageNotFoundError:
            self._disabled_providers.append(registration)
            return

        if provider not in self._providers:
            self._providers[provider] = []
        self._providers[provider].append(registration)

    def create_client(self, provider: str, model: str, **kwargs: Any) -> Any:
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
        if not registration.dependencies:
            return

        for dep in registration.dependencies:
            version(dep)

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
    """Generate a formatted table showing provider availability.

    Returns:
        str: A formatted string table showing available and disabled providers.
    """
    all_providers: List[ProviderInfo] = []
    output: List[str] = []

    for provider_name, registrations in PROVIDER_REGISTRY._providers.items():
        for reg in registrations:
            enabled_provider: ProviderInfo = {
                "provider": provider_name,
                "client": reg.client_name,
                "dependencies": reg.dependencies,
                "status": "✓ Available",
                "is_enabled": True,
            }
            all_providers.append(enabled_provider)

    for reg in PROVIDER_REGISTRY._disabled_providers:
        disabled_provider: ProviderInfo = {
            "provider": reg.provider,
            "client": reg.client_name,
            "dependencies": reg.dependencies,
            "status": "✗ Disabled ",
            "is_enabled": False,
        }
        all_providers.append(disabled_provider)

    if all_providers:
        table_width = _calculate_table_width(all_providers)
        output.append(f"\n{emoji_guard('📦 ')}AVAILABLE PROVIDERS (sorted by client priority)")
        output.append("-" * table_width)
        output.append(_get_consolidated_provider_table(all_providers))
    else:
        output.append(f"\n{emoji_guard('📦 ')}PROVIDERS: None")

    return "\n".join(output)


def _calculate_table_width(providers: List[ProviderInfo]) -> int:
    if not providers:
        return 0

    max_provider = max(len(p["provider"]) for p in providers)
    max_client = max(len(p["client"]) for p in providers)
    max_deps = max(len(", ".join(p["dependencies"])) for p in providers)
    max_status = max(len(p["status"]) for p in providers)

    provider_width = max(max_provider, 8)
    client_width = max(max_client, 7)
    deps_width = max(max_deps, 12)
    status_width = max(max_status, 6)

    return provider_width + status_width + client_width + deps_width + 9  # 9 for " | " separators


def _color_dependencies(dependencies: List[str]) -> str:
    colored_deps: List[str] = []

    for dep in dependencies:
        try:
            version(dep)
            colored_deps.append(f"{Colors.GREEN}{dep}{Colors.RESET}")
        except PackageNotFoundError:
            colored_deps.append(f"{Colors.RED}{dep}{Colors.RESET}")

    return ", ".join(colored_deps)


def _get_consolidated_provider_table(providers: List[ProviderInfo]) -> str:
    if not providers:
        return ""

    max_provider = max(len(p["provider"]) for p in providers)
    max_client = max(len(p["client"]) for p in providers)
    max_deps = max(len(", ".join(p["dependencies"])) for p in providers)
    max_status = max(len(p["status"]) for p in providers)

    provider_width = max(max_provider, 8)
    client_width = max(max_client, 7)
    deps_width = max(max_deps, 12)
    status_width = max(max_status, 6)

    header = (
        f"{'Provider':<{provider_width}} | {'Status':<{status_width}} | "
        f"{'Client':<{client_width}} | {'Dependencies':<{deps_width}}"
    )

    total_width = _calculate_table_width(providers)
    output = [header, "-" * total_width]

    for p in providers:
        deps_colored = _color_dependencies(p["dependencies"]) if p["dependencies"] else "None"

        if p["is_enabled"]:
            status_colored = f"{Colors.GREEN}{p['status']:<{status_width}}{Colors.RESET}"
        else:
            status_colored = f"{Colors.RED}{p['status']:<{status_width}}{Colors.RESET}"

        row = (
            f"{p['provider']:<{provider_width}} | {status_colored} | "
            f"{p['client']:<{client_width}} | {deps_colored:<{deps_width}}"
        )
        output.append(row)

    return "\n".join(output)


def register_adapter(
    identifier: Callable[[Any], bool],
    name: str = "",
) -> Callable[[Type["BaseLLMAdapter"]], Type["BaseLLMAdapter"]]:
    """Decorator to register an adapter in the global registry.

    Args:
        identifier (Callable[[Any], bool]): Function that returns True if the client is compatible
            with this adapter.
        name (str): Optional name for the adapter (defaults to class name).

    Returns:
        Callable[[Type["BaseLLMAdapter"]], Type["BaseLLMAdapter"]]: A decorator function.

    Example::

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
    get_rate_limit_errors: Optional[Callable[..., List[Type[Exception]]]] = None,
    dependencies: Optional[List[str]] = None,
) -> Callable[[Type["BaseLLMAdapter"]], Type["BaseLLMAdapter"]]:
    """Decorator to register a provider with an adapter.

    Args:
        provider (str): Provider name (e.g., "openai", "anthropic").
        client_factory (Callable[..., Any]): Factory function to create clients for this provider.
        get_rate_limit_errors (Optional[Callable[..., List[Type[Exception]]]]): Optional function
            to get rate limit errors for this client/provider.
        dependencies (Optional[List[str]]): Optional list of required pip package names.

    Returns:
        Callable[[Type["BaseLLMAdapter"]], Type["BaseLLMAdapter"]]: A decorator function.

    Example::

        @register_provider(
            provider="openai",
            client_factory=_create_openai_langchain_client,
            get_rate_limit_errors=lambda: [OpenAIRateLimitError],
            dependencies=["langchain", "langchain-openai"]
        )
        class LangChainModelAdapter(BaseLLMAdapter):
            pass
    """

    def decorator(adapter_class: Type["BaseLLMAdapter"]) -> Type["BaseLLMAdapter"]:
        PROVIDER_REGISTRY.register_provider(
            provider=provider,
            adapter_class=adapter_class,
            client_factory=client_factory,
            get_rate_limit_errors=get_rate_limit_errors,
            dependencies=dependencies,
        )
        return adapter_class

    return decorator

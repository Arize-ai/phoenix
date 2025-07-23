import logging
from typing import Any, Callable, Dict, List, Optional, Type, TypedDict

from .types import AdapterRegistration, BaseLLMAdapter, ProviderRegistration

logger = logging.getLogger(__name__)


class ProviderInfo(TypedDict):
    provider: str
    adapter: str
    dependencies: List[str]
    status: str


class DisabledProviderInfo(TypedDict):
    provider: str
    adapter: str
    dependencies: List[str]
    missing: List[str]
    status: str


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


def print_available_adapters() -> None:
    """
    Print a comprehensive table of available LLM adapters and providers.

    Shows:
    1. Available providers (dependencies satisfied)
    2. Disabled providers (missing dependencies)
    3. SDK adapters (for wrapping existing clients)
    """
    print("\n" + "=" * 80)
    print("PHOENIX LLM WRAPPER - AVAILABLE ADAPTERS & PROVIDERS")
    print("=" * 80)

    # 1. Available Providers
    available_providers = []
    for provider_name, registrations in PROVIDER_REGISTRY._providers.items():
        for reg in registrations:
            available_providers.append(
                {
                    "provider": provider_name,
                    "adapter": reg.adapter_class.__name__,
                    "dependencies": reg.dependencies,
                    "status": "✓ Available",
                }
            )

    if available_providers:
        print("\n📦 AVAILABLE PROVIDERS (Dependencies Satisfied)")
        print("-" * 60)
        _print_provider_table(available_providers)
    else:
        print("\n📦 AVAILABLE PROVIDERS: None")

    # 2. Disabled Providers
    disabled_providers = []
    for reg in PROVIDER_REGISTRY._disabled_providers:
        missing_deps = _get_missing_dependencies(reg.dependencies)
        disabled_providers.append(
            {
                "provider": reg.provider,
                "adapter": reg.adapter_class.__name__,
                "dependencies": reg.dependencies,
                "missing": missing_deps,
                "status": "✗ Missing Dependencies",
            }
        )

    if disabled_providers:
        print("\n❌ DISABLED PROVIDERS (Missing Dependencies)")
        print("-" * 60)
        _print_disabled_provider_table(disabled_providers)
    else:
        print("\n❌ DISABLED PROVIDERS: None")

    # 3. SDK Adapters
    sdk_adapters = []
    for reg in ADAPTER_REGISTRY._adapters:
        sdk_adapters.append(
            {
                "name": reg.name,
                "adapter": reg.adapter_class.__name__,
                "description": _get_adapter_description(reg.name),
            }
        )

    if sdk_adapters:
        print("\n🔧 SDK ADAPTERS (For Wrapping Existing Clients)")
        print("-" * 60)
        _print_sdk_adapter_table(sdk_adapters)
    else:
        print("\n🔧 SDK ADAPTERS: None")

    print("\n" + "=" * 80)
    print("USAGE EXAMPLES:")
    print("=" * 80)
    print("# Using a provider (Phoenix creates the client):")
    print("llm = LLM(provider='openai', model='gpt-4')")
    print()
    print("# Using an existing SDK client:")
    print("import openai")
    print("client = openai.OpenAI()")
    print("llm = LLM(client=client)")
    print("=" * 80 + "\n")


def _print_provider_table(providers: List[ProviderInfo]) -> None:
    """Print a formatted table of available providers."""
    if not providers:
        return

    # Calculate column widths
    max_provider = max(len(p["provider"]) for p in providers)
    max_adapter = max(len(p["adapter"]) for p in providers)
    max_deps = max(len(", ".join(p["dependencies"])) for p in providers)

    provider_width = max(max_provider, 8)
    adapter_width = max(max_adapter, 7)
    deps_width = max(max_deps, 12)

    # Header
    header = (
        f"{'Provider':<{provider_width}} | {'Adapter':<{adapter_width}} | "
        f"{'Dependencies':<{deps_width}} | Status"
    )
    print(header)
    print("-" * len(header))

    # Rows
    for p in providers:
        deps_str = ", ".join(p["dependencies"]) if p["dependencies"] else "None"
        print(
            f"{p['provider']:<{provider_width}} | {p['adapter']:<{adapter_width}} | "
            f"{deps_str:<{deps_width}} | {p['status']}"
        )


def _print_disabled_provider_table(providers: List[DisabledProviderInfo]) -> None:
    """Print a formatted table of disabled providers."""
    if not providers:
        return

    # Calculate column widths
    max_provider = max(len(p["provider"]) for p in providers)
    max_adapter = max(len(p["adapter"]) for p in providers)
    max_missing = max(len(", ".join(p["missing"])) for p in providers)

    provider_width = max(max_provider, 8)
    adapter_width = max(max_adapter, 7)
    missing_width = max(max_missing, 12)

    # Header
    header = (
        f"{'Provider':<{provider_width}} | {'Adapter':<{adapter_width}} | "
        f"{'Missing Deps':<{missing_width}} | Install Command")
    print(header)
    print("-" * len(header))

    # Rows
    for p in providers:
        missing_str = ", ".join(p["missing"]) if p["missing"] else "Unknown"
        install_cmd = (
            f"pip install {' '.join(p['missing'])}"
            if p["missing"]
            else "pip install " + " ".join(p["dependencies"])
        )
        print(
            f"{p['provider']:<{provider_width}} | {p['adapter']:<{adapter_width}} | "
            f"{missing_str:<{missing_width}} | {install_cmd}"
        )


def _print_sdk_adapter_table(adapters: List[AdapterInfo]) -> None:
    """Print a formatted table of SDK adapters."""
    if not adapters:
        return

    # Calculate column widths
    max_name = max(len(a["name"]) for a in adapters)
    max_adapter = max(len(a["adapter"]) for a in adapters)
    max_desc = max(len(a["description"]) for a in adapters)

    name_width = max(max_name, 4)
    adapter_width = max(max_adapter, 7)
    desc_width = max(max_desc, 11)

    # Header
    header = (
        f"{'Name':<{name_width}} | {'Adapter':<{adapter_width}} | {'Description':<{desc_width}}"
    )
    print(header)
    print("-" * len(header))

    # Rows
    for a in adapters:
        print(
            f"{a['name']:<{name_width}} | {a['adapter']:<{adapter_width}} | "
            f"{a['description']:<{desc_width}}"
        )


def _get_missing_dependencies(dependencies: List[str]) -> List[str]:
    """Check which dependencies are missing."""
    missing = []
    for dep in dependencies:
        try:
            __import__(dep)
        except ImportError:
            missing.append(dep)
    return missing


def _get_adapter_description(adapter_name: str) -> str:
    """Get a description for the adapter based on its name."""
    descriptions = {
        "openai": "Wraps OpenAI SDK clients (openai.OpenAI, openai.AsyncOpenAI)",
        "langchain": "Wraps LangChain model instances with invoke/predict methods",
        "litellm": "Wraps LiteLLM clients for multi-provider support",
    }
    return descriptions.get(adapter_name, f"Wraps {adapter_name} SDK clients")


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

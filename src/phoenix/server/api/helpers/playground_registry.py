from typing import TYPE_CHECKING, Any, Callable, Optional, Union

from phoenix.server.api.types.GenerativeProvider import GenerativeProviderKey

if TYPE_CHECKING:
    from phoenix.server.api.helpers.playground_clients import PlaygroundStreamingClient

ModelName = Union[str, None]
ModelKey = tuple[GenerativeProviderKey, ModelName]

PROVIDER_DEFAULT = None


class SingletonMeta(type):
    _instances: dict[Any, Any] = dict()

    def __call__(cls, *args: Any, **kwargs: Any) -> Any:
        if cls not in cls._instances:
            cls._instances[cls] = super(SingletonMeta, cls).__call__(*args, **kwargs)
        return cls._instances[cls]


class PlaygroundClientRegistry(metaclass=SingletonMeta):
    def __init__(self) -> None:
        self._registry: dict[
            GenerativeProviderKey, dict[ModelName, Optional[type["PlaygroundStreamingClient"]]]
        ] = {}

    def get_client(
        self,
        provider_key: GenerativeProviderKey,
        model_name: ModelName,
    ) -> Optional[type["PlaygroundStreamingClient"]]:
        provider_registry = self._registry.get(provider_key, {})
        client_class = provider_registry.get(model_name)
        if client_class is None and None in provider_registry:
            client_class = provider_registry[PROVIDER_DEFAULT]  # Fallback to provider default
        return client_class

    def list_all_providers(
        self,
    ) -> list[GenerativeProviderKey]:
        return [provider_key for provider_key in self._registry]

    def list_models(self, provider_key: GenerativeProviderKey) -> list[str]:
        provider_registry = self._registry.get(provider_key, {})
        return [model_name for model_name in provider_registry.keys() if model_name is not None]

    def list_all_models(self) -> list[ModelKey]:
        return [
            (provider_key, model_name)
            for provider_key, provider_registry in self._registry.items()
            for model_name in provider_registry.keys()
        ]


PLAYGROUND_CLIENT_REGISTRY: PlaygroundClientRegistry = PlaygroundClientRegistry()


def register_llm_client(
    provider_key: GenerativeProviderKey,
    model_names: list[ModelName],
) -> Callable[[type["PlaygroundStreamingClient"]], type["PlaygroundStreamingClient"]]:
    def decorator(cls: type["PlaygroundStreamingClient"]) -> type["PlaygroundStreamingClient"]:
        provider_registry = PLAYGROUND_CLIENT_REGISTRY._registry.setdefault(provider_key, {})
        for model_name in model_names:
            provider_registry[model_name] = cls
        return cls

    return decorator

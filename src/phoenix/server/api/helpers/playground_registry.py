from typing import TYPE_CHECKING, Callable, Dict, List, Optional, Tuple, Type

from phoenix.server.api.types.GenerativeProvider import GenerativeProviderKey

if TYPE_CHECKING:
    from phoenix.server.api.subscriptions import PlaygroundStreamingClient

ModelKey = Tuple[GenerativeProviderKey, str | None]

PROVIDER_DEFAULT = None


class SingletonMeta(type):
    _instances = dict()

    def __call__(cls, *args, **kwargs):
        if cls not in cls._instances:
            cls._instances[cls] = super(SingletonMeta, cls).__call__(*args, **kwargs)
        return cls._instances[cls]


class PlaygroundClientRegistry(metaclass=SingletonMeta):
    def __init__(self):
        self._registry: Dict[
            GenerativeProviderKey, Dict[str | None, Type["PlaygroundStreamingClient"]]
        ] = {}

    def get_client(
        self,
        provider_key: GenerativeProviderKey,
        model_name: str | None,
    ) -> Optional[Type["PlaygroundStreamingClient"]]:
        provider_registry = self._registry.get(provider_key, {})
        client_class = provider_registry.get(model_name)
        if client_class is None and None in provider_registry:
            client_class = provider_registry[PROVIDER_DEFAULT]  # Fallback to provider default
        return client_class

    def list_models(self, provider_key: GenerativeProviderKey) -> List[str]:
        provider_registry = self._registry.get(provider_key, {})
        return [model_name for model_name in provider_registry.keys() if model_name is not None]

    def list_all_models(self) -> List[ModelKey]:
        return [
            (provider_key, model_name)
            for provider_key, provider_registry in self._registry.items()
            for model_name in provider_registry.keys()
        ]


PLAYGROUND_CLIENT_REGISTRY: PlaygroundClientRegistry = PlaygroundClientRegistry()


def register_llm_client(
    provider_key: GenerativeProviderKey,
    model_names: List[str | None],
) -> Callable[[Type["PlaygroundStreamingClient"]], Type["PlaygroundStreamingClient"]]:
    def decorator(cls: Type["PlaygroundStreamingClient"]) -> Type["PlaygroundStreamingClient"]:
        provider_registry = PLAYGROUND_CLIENT_REGISTRY._registry.setdefault(provider_key, {})
        for model_name in model_names:
            provider_registry[model_name] = cls
        return cls

    return decorator

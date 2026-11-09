"""Registry of built-in model providers, their supported model types, and default model lists."""

from typing import TYPE_CHECKING, Any, Callable, Optional, Sequence, TypeVar, Union

from phoenix.db.types.model_provider import ModelTypeKey
from phoenix.server.api.types.GenerativeProvider import GenerativeProviderKey

if TYPE_CHECKING:
    from phoenix.server.api.helpers.model_clients import ModelClient

ModelName = Union[str, None]
ModelKey = tuple[GenerativeProviderKey, ModelName]

PROVIDER_DEFAULT = None

MODEL_TYPES: tuple[ModelTypeKey, ...] = ("chat", "decision")

ClientClassT = TypeVar("ClientClassT", bound="type[ModelClient[Any]]")


class SingletonMeta(type):
    _instances: dict[Any, Any] = dict()

    def __call__(cls, *args: Any, **kwargs: Any) -> Any:
        if cls not in cls._instances:
            cls._instances[cls] = super(SingletonMeta, cls).__call__(*args, **kwargs)
        return cls._instances[cls]


def filter_allowed_providers(
    provider_keys: Sequence[GenerativeProviderKey],
    allowed_provider_names: Optional[frozenset[str]],
) -> list[GenerativeProviderKey]:
    """Narrow ``provider_keys`` to the ``PHOENIX_ALLOWED_PROVIDERS`` allow-list.

    ``None`` means unrestricted, while an empty set permits nothing.
    """
    if allowed_provider_names is None:
        return list(provider_keys)
    return [
        provider_key
        for provider_key in provider_keys
        if provider_key.name in allowed_provider_names
    ]


def _load_clients() -> None:
    import phoenix.server.api.helpers.chat_clients  # noqa: F401
    import phoenix.server.api.helpers.decision_clients  # noqa: F401


class ClientRegistry(metaclass=SingletonMeta):
    def __init__(self) -> None:
        self._registry: dict[
            ModelTypeKey,
            dict[GenerativeProviderKey, dict[ModelName, type["ModelClient[Any]"]]],
        ] = {model_type: {} for model_type in MODEL_TYPES}

    def get_client(
        self,
        provider_key: GenerativeProviderKey,
        model_name: ModelName = PROVIDER_DEFAULT,
        *,
        model_type: ModelTypeKey,
    ) -> Optional[type["ModelClient[Any]"]]:
        """Return the client registered for ``model_name``, falling back to ``PROVIDER_DEFAULT``."""
        _load_clients()
        provider_registry = self._registry[model_type].get(provider_key, {})
        client_class = provider_registry.get(model_name)
        if client_class is None:
            client_class = provider_registry.get(PROVIDER_DEFAULT)
        return client_class

    def model_types(self, provider_key: GenerativeProviderKey) -> list[ModelTypeKey]:
        _load_clients()
        return [
            model_type for model_type in MODEL_TYPES if provider_key in self._registry[model_type]
        ]

    def offers(self, provider_key: GenerativeProviderKey, model_type: ModelTypeKey) -> bool:
        return model_type in self.model_types(provider_key)

    def list_all_providers(self, *, model_type: ModelTypeKey) -> list[GenerativeProviderKey]:
        _load_clients()
        return list(self._registry[model_type])

    def list_allowed_providers(
        self,
        allowed_provider_names: Optional[frozenset[str]],
        *,
        model_type: ModelTypeKey,
    ) -> list[GenerativeProviderKey]:
        return filter_allowed_providers(
            self.list_all_providers(model_type=model_type), allowed_provider_names
        )

    def list_models(
        self, provider_key: GenerativeProviderKey, *, model_type: ModelTypeKey
    ) -> list[str]:
        _load_clients()
        provider_registry = self._registry[model_type].get(provider_key, {})
        return [model_name for model_name in provider_registry if model_name is not None]

    def list_all_models(self, *, model_type: ModelTypeKey) -> list[ModelKey]:
        _load_clients()
        return [
            (provider_key, model_name)
            for provider_key, provider_registry in self._registry[model_type].items()
            for model_name in provider_registry
        ]


CLIENT_REGISTRY: ClientRegistry = ClientRegistry()


def require_chat_provider(provider_key: GenerativeProviderKey) -> None:
    from phoenix.server.api.exceptions import BadRequest

    if not CLIENT_REGISTRY.offers(provider_key, "chat"):
        raise BadRequest(
            f"{provider_key.value} offers decision models only and cannot be used for "
            "chat completions. Choose a chat model provider, or run it as a decision model."
        )


def register_client(
    provider_key: GenerativeProviderKey,
    model_names: Sequence[ModelName],
    *,
    model_type: ModelTypeKey,
) -> Callable[[ClientClassT], ClientClassT]:
    """Register a provider's built-in models and default client for ``model_type``.

    Include ``PROVIDER_DEFAULT`` to register the provider's default client (used for
    dependency checks and decision dispatch; chat runtime dispatch uses
    ``get_openai_client_class`` and ``_chat_client_class`` in ``chat_clients``).
    """

    def decorator(cls: ClientClassT) -> ClientClassT:
        provider_registry = CLIENT_REGISTRY._registry[model_type].setdefault(provider_key, {})
        for model_name in model_names:
            provider_registry[model_name] = cls
        return cls

    return decorator

from typing import Any, Dict, Optional

from .adapters import register_adapters
from .registries import ADAPTER_REGISTRY, PROVIDER_REGISTRY


register_adapters()


class LLMBase:
    def __init__(
        self,
        *,
        client: Optional[Any] = None,
        provider: Optional[str] = None,
        model: Optional[str] = None,
    ):
        self._is_async: bool = getattr(self, "_is_async", False)
        self.client = client
        self.provider = provider
        self.model = model

        by_sdk = client is not None
        by_provider = provider is not None and model is not None

        if not (by_sdk or by_provider):
            raise ValueError(
                "Must specify either 'client' or both 'provider' and 'model'. "
                "Examples:\n"
                "  LLM(client=my_client)\n"
                "  LLM(provider='openai', model='gpt-4')"
            )

        if by_provider:
            try:
                provider_registrations = PROVIDER_REGISTRY.get_provider_registrations(provider)
                if not provider_registrations:
                    available_providers = PROVIDER_REGISTRY.list_providers()
                    raise ValueError(
                        f"Unknown provider '{provider}'. Available providers: {available_providers}"
                    )

                registration = provider_registrations[0]
                client = registration.client_factory(model=model, is_async=self._is_async)
                adapter_class = registration.adapter_class

            except Exception as e:
                available_providers = PROVIDER_REGISTRY.list_providers()
                raise ValueError(
                    f"Failed to create client for provider '{provider}': {e}\n"
                    f"Available providers: {available_providers}"
                ) from e
        elif by_sdk:
            adapter_class = ADAPTER_REGISTRY.find_adapter(client)
            if adapter_class is None:
                available_adapters = ADAPTER_REGISTRY.list_adapters()
                raise ValueError(
                    f"No suitable adapter found for client of type {type(client)}. "
                    f"Available adapters: {available_adapters}. "
                    f"Please ensure you have the correct SDK installed and the client is properly "
                    "initialized."
                )

        self._client = client
        self._adapter = adapter_class(client)


class LLM(LLMBase):
    def __init__(self, *args: Any, **kwargs: Any):
        self._is_async = False
        super().__init__(*args, **kwargs)

    def generate_text(self, prompt: str, **kwargs: Any) -> str:
        return self._adapter.generate_text(prompt, **kwargs)

    def generate_object(self, prompt: str, schema: Dict[str, Any], **kwargs: Any) -> Dict[str, Any]:
        return self._adapter.generate_object(prompt, schema, **kwargs)


class AsyncLLM(LLMBase):
    def __init__(self, *args: Any, **kwargs: Any):
        self._is_async = True
        super().__init__(*args, **kwargs)

    async def generate_text(self, prompt: str, **kwargs: Any) -> str:
        return await self._adapter.agenerate_text(prompt, **kwargs)

    async def generate_object(
        self, prompt: str, schema: Dict[str, Any], **kwargs: Any
    ) -> Dict[str, Any]:
        return await self._adapter.agenerate_object(prompt, schema, **kwargs)

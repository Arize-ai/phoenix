from typing import Any, Dict, Optional

from .adapters import register_adapters
from .registries import PROVIDER_REGISTRY, adapter_availability_table

register_adapters()


class LLMBase:
    def __init__(
        self,
        *,
        # client: Optional[Any] = None,
        provider: Optional[str] = None,
        model: Optional[str] = None,
        client: Optional[str] = None,
    ):
        self._is_async: bool = getattr(self, "_is_async", False)
        # self.client = client
        self.provider = provider
        self.model = model

        # by_sdk = client is not None
        by_provider = provider is not None and model is not None

        if not by_provider:
            # raise ValueError(
            #     "Must specify either 'client' or both 'provider' and 'model'. "
            #     "Examples:\n"
            #     "  LLM(client=my_client)\n"
            #     "  LLM(provider='openai', model='gpt-4')"
            # )
            raise ValueError(
                "Must specify both 'provider' and 'model'. "
                "Examples:\n"
                "  LLM(provider='openai', model='gpt-4')"
            )

        if by_provider:
            if provider is None:
                raise ValueError("Provider must be specified for provider-based initialization")

            provider_registrations = PROVIDER_REGISTRY.get_provider_registrations(provider)
            if not provider_registrations:
                raise ValueError(f"Unknown provider '{provider}'. {adapter_availability_table()}")

            if client is not None:
                for r in provider_registrations:
                    if r.client_name == client:
                        registration = r
                        break
                else:
                    raise ValueError(f"Unknown client '{client}'. {adapter_availability_table()}")
            else:
                registration = provider_registrations[0]

            try:
                client = registration.client_factory(model=model, is_async=self._is_async)
                adapter_class = registration.adapter_class
            except Exception as e:
                raise ValueError(f"Failed to create client for provider '{provider}': {e}") from e
        # elif by_sdk:
        #     adapter_class_maybe = ADAPTER_REGISTRY.find_adapter(client)
        #     if adapter_class_maybe is None:
        #         raise ValueError(
        #             f"No suitable adapter found for client of type {type(client)}. "
        #             f"{adapter_availability_table()}"
        #             f"Please ensure you have the correct SDK installed and the client is "
        #             "properly initialized."
        #         )
        #     adapter_class = adapter_class_maybe
        else:
            # This should never happen due to the initial validation
            raise ValueError("Internal error: cannot initialize LLM wrapper.")

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

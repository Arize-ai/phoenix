from typing import Any, Dict, Optional, Union

from phoenix.evals.templates import MultimodalPrompt

from .adapters import register_adapters
from .registries import PROVIDER_REGISTRY, adapter_availability_table

register_adapters()


class LLMBase:
    def __init__(
        self,
        *,
        provider: Optional[str] = None,
        model: Optional[str] = None,
        client: Optional[str] = None,
    ):
        self._is_async: bool = getattr(self, "_is_async", False)
        self.provider = provider
        self.model = model

        by_provider = provider is not None and model is not None

        if not by_provider:
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

        else:
            # This should never happen due to the initial validation
            raise ValueError("Internal error: cannot initialize LLM wrapper.")

        self._client = client
        self._adapter = adapter_class(client)


class LLM(LLMBase):
    """
    An LLM wrapper that simplifies the API for generating text and objects.

    This wrapper delegates API access to SDK/client libraries that are installed in the active
    Python environment. To show supported providers, use `show_provider_availability()`.

    Args:
        provider: The name of the provider to use.
        model: The name of the model to use.
        client: Optionally, name of the client to use. If not specified, the first available client
            for the provider will be used.

    Examples:
        >>> from phoenix.evals.llm import LLM, show_provider_availability
        >>> show_provider_availability()
        >>> llm = LLM(provider="openai", model="gpt-4o")
        >>> llm.generate_text(prompt="Hello, world!")
        "Hello, world!"
        >>> llm.generate_object(
        ...     prompt="Hello, world!",
        ...     schema={
        ...     "type": "object",
        ...     "properties": {
        ...         "text": {"type": "string"}
        ...     },
        ...     "required": ["text"]
        ... })
        {"text": "Hello, world!"}
    """

    def __init__(self, *args: Any, **kwargs: Any):
        self._is_async = False
        super().__init__(*args, **kwargs)

    def generate_text(self, prompt: Union[str, MultimodalPrompt], **kwargs: Any) -> str:
        """
        Generate text given a prompt.

        Args:
            prompt: The prompt to generate text from.
            **kwargs: Additional keyword arguments to pass to the LLM SDK.

        Returns:
            The generated text.
        """
        return self._adapter.generate_text(prompt, **kwargs)

    def generate_object(
        self, prompt: Union[str, MultimodalPrompt], schema: Dict[str, Any], **kwargs: Any
    ) -> Dict[str, Any]:
        """
        Generate an object given a prompt and a schema.

        Args:
            prompt: The prompt to generate the object from.
            schema: A JSON schema that describes the generated object.
            **kwargs: Additional keyword arguments to pass to the LLM SDK.

        Returns:
            The generated object.
        """
        return self._adapter.generate_object(prompt, schema, **kwargs)


class AsyncLLM(LLMBase):
    """
    An asynchronous LLM wrapper that simplifies the API for generating text and objects.

    This wrapper delegates API access to SDK/client libraries that are installed in the active
    Python environment. To show supported providers, use `show_provider_availability()`.

    Args:
        provider: The name of the provider to use.
        model: The name of the model to use.
        client: Optionally, name of the client to use. If not specified, the first available client
            for the provider will be used.

    Examples:
        >>> from phoenix.evals.llm import AsyncLLM, show_provider_availability
        >>> show_provider_availability()
        >>> llm = AsyncLLM(provider="openai", model="gpt-4o")
        >>> await llm.generate_text(prompt="Hello, world!")
        "Hello, world!"
        >>> await llm.generate_object(
        ...     prompt="Hello, world!",
        ...     schema={
        ...     "type": "object",
        ...     "properties": {
        ...         "text": {"type": "string"}
        ...     },
        ...     "required": ["text"]
        ... })
        {"text": "Hello, world!"}
    """

    def __init__(self, *args: Any, **kwargs: Any):
        self._is_async = True
        super().__init__(*args, **kwargs)

    async def generate_text(self, prompt: Union[str, MultimodalPrompt], **kwargs: Any) -> str:
        """
        Asynchronously generate text given a prompt.

        Args:
            prompt: The prompt to generate text from.
            **kwargs: Additional keyword arguments to pass to the LLM SDK.

        Returns:
            The generated text.
        """
        return await self._adapter.agenerate_text(prompt, **kwargs)

    async def generate_object(
        self, prompt: Union[str, MultimodalPrompt], schema: Dict[str, Any], **kwargs: Any
    ) -> Dict[str, Any]:
        """
        Asynchronously generate an object given a prompt and a schema.

        Args:
            prompt: The prompt to generate the object from.
            schema: A JSON schema that describes the generated object.
            **kwargs: Additional keyword arguments to pass to the LLM SDK.

        Returns:
            The generated object.
        """
        return await self._adapter.agenerate_object(prompt, schema, **kwargs)


def show_provider_availability() -> None:
    """Show the availability of all providers."""
    print(adapter_availability_table())

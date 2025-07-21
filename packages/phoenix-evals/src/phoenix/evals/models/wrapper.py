"""
Universal LLM Wrapper for Phoenix Evals

This module provides a unified interface for various LLM SDKs and model objects,
allowing users to work with different LLM providers through a consistent API.

Features an elegant adapter registry system that automatically detects and delegates
to the appropriate adapter based on client characteristics.
"""

from typing import Any, Dict, List, Optional, Tuple, Union

from phoenix.evals.templates import MultimodalPrompt

# Import adapters to ensure they are registered
from .adapters.langchain import LangChainModelAdapter  # noqa: F401
from .adapters.litellm import LiteLLMAdapter  # noqa: F401

# Import core components
from .core.base import BaseLLMAdapter
from .core.registries import _adapter_registry, _provider_registry


class UniversalLLMWrapper:
    """
    Universal wrapper that provides a simplified interface for LLM access.

    Supports two initialization modes:
    1. Client-based: Pass a pre-instantiated client
    2. Provider-based: Specify provider and model for automatic client creation

    Focuses on the 4 core methods:
    - generate_text (sync text generation)
    - agenerate_text (async text generation)
    - generate_object (sync structured output)
    - agenerate_object (async structured output)

    Maintains compatibility with the existing Phoenix BaseModel interface.
    """

    def __init__(
        self,
        *,
        client: Optional[Any] = None,
        provider: Optional[str] = None,
        model: Optional[str] = None,
        **kwargs,
    ):
        """
        Initialize the wrapper with either a client or provider/model specification.

        Args:
            client: Pre-instantiated SDK client/model object (mutually exclusive with provider/model)
            provider: Provider name for automatic client creation (e.g., "openai", "anthropic")
            model: Model name/identifier (required when using provider)
            **kwargs: Additional configuration options (passed to client factory or BaseModel)

        Examples:
            # Client-based initialization (existing usage)
            wrapper = UniversalLLMWrapper(client=my_langchain_model)

            # Provider-based initialization (new usage)
            wrapper = UniversalLLMWrapper(provider="openai", model="gpt-4", api_key="...")
            wrapper = UniversalLLMWrapper(provider="anthropic", model="claude-3-sonnet")
        """
        # Validate arguments
        if client is not None and (provider is not None or model is not None):
            raise ValueError(
                "Cannot specify both 'client' and 'provider'/'model'. "
                "Use either client-based or provider-based initialization."
            )

        if client is None and (provider is None or model is None):
            raise ValueError(
                "Must specify either 'client' or both 'provider' and 'model'. "
                "Examples:\n"
                "  UniversalLLMWrapper(client=my_client)\n"
                "  UniversalLLMWrapper(provider='openai', model='gpt-4')"
            )

        # All kwargs go to client factory
        client_factory_kwargs = kwargs

        # Handle provider-based initialization
        if provider is not None:
            try:
                # Get the provider registration to access both client factory and target adapter
                provider_registrations = _provider_registry.get_provider_registrations(provider)
                if not provider_registrations:
                    available_providers = _provider_registry.list_providers()
                    raise ValueError(
                        f"Unknown provider '{provider}'. Available providers: {available_providers}"
                    )

                # Use the first registration (could be enhanced with selection logic)
                registration = provider_registrations[0]

                # Create client using the factory
                client = registration.client_factory(model=model, **client_factory_kwargs)

                # Use the adapter class directly from the registration
                adapter_class = registration.adapter_class

            except Exception as e:
                available_providers = _provider_registry.list_providers()
                raise ValueError(
                    f"Failed to create client for provider '{provider}': {e}\n"
                    f"Available providers: {available_providers}"
                ) from e
        else:
            # Client-based initialization - find appropriate adapter for the client
            adapter_class = _adapter_registry.find_adapter(client)
            if adapter_class is None:
                # Provide helpful error message with available adapters
                available_adapters = _adapter_registry.list_adapters()
                adapter_list = ", ".join(
                    [f"{name} (priority: {priority})" for name, priority in available_adapters]
                )
                raise ValueError(
                    f"No suitable adapter found for client of type {type(client)}. "
                    f"Available adapters: {adapter_list}. "
                    f"Please ensure you have the correct SDK installed and the client is properly initialized."
                )

        # Initialize the selected adapter
        self._adapter = adapter_class(client)

        # Store original client for access
        self._client = client

    @property
    def _model_name(self) -> str:
        """Return the model name from the adapter."""
        return self._adapter.model_name

    def _generate(self, prompt: Union[str, MultimodalPrompt], **kwargs: Any) -> str:
        """Generate text using the adapter (required by BaseModel)."""
        return self._adapter.generate_text(prompt, **kwargs)

    async def _async_generate(self, prompt: Union[str, MultimodalPrompt], **kwargs: Any) -> str:
        """Async text generation using the adapter (required by BaseModel)."""
        return await self._adapter.agenerate_text(prompt, **kwargs)

    def generate_text(
        self, prompt: Union[str, MultimodalPrompt], instruction: Optional[str] = None, **kwargs: Any
    ) -> str:
        """Generate text using the adapter."""
        return self._adapter.generate_text(prompt, instruction, **kwargs)

    async def agenerate_text(
        self, prompt: Union[str, MultimodalPrompt], instruction: Optional[str] = None, **kwargs: Any
    ) -> str:
        """Async text generation using the adapter."""
        return await self._adapter.agenerate_text(prompt, instruction, **kwargs)

    def generate_object(
        self,
        prompt: Union[str, MultimodalPrompt],
        schema: Dict[str, Any],
        **kwargs: Any,
    ) -> Dict[str, Any]:
        """
        Generate structured output using the adapter.

        Returns:
            A dictionary containing the structured data that conforms to the provided schema.
        """
        return self._adapter.generate_object(prompt, schema, **kwargs)

    async def agenerate_object(
        self,
        prompt: Union[str, MultimodalPrompt],
        schema: Dict[str, Any],
        **kwargs: Any,
    ) -> Dict[str, Any]:
        """
        Async structured output using the adapter.

        Returns:
            A dictionary containing the structured data that conforms to the provided schema.
        """
        return await self._adapter.agenerate_object(prompt, schema, **kwargs)

    @property
    def adapter(self) -> BaseLLMAdapter:
        """Access to the underlying adapter."""
        return self._adapter

    @property
    def client(self) -> Any:
        """Access to the original client object."""
        return self._client


# Convenience functions and utilities


def list_available_adapters() -> List[Tuple[str, int]]:
    """
    List all registered adapters with their priorities.

    Returns:
        List of tuples containing (adapter_name, priority)
    """
    return _adapter_registry.list_adapters()


def list_available_providers() -> List[str]:
    """
    List all available providers for client instantiation.

    Returns:
        List of provider names
    """
    return _provider_registry.list_providers()


def get_adapter_for_client(client: Any) -> Optional[str]:
    """
    Get the name of the adapter that would be used for a given client.

    Args:
        client: The client object to check

    Returns:
        Name of the matching adapter, or None if no adapter matches
    """
    adapter_class = _adapter_registry.find_adapter(client)
    if adapter_class is None:
        return None

    # Find the adapter name from the registry
    for registration in _adapter_registry._adapters:
        if registration.adapter_class == adapter_class:
            return registration.name
    return adapter_class.__name__


def create_example_openai_adapter() -> str:
    """
    Return example code for creating an OpenAI adapter with provider support.

    This is a utility function to help users understand how to extend
    the system with new adapters.
    """
    return '''
def _create_openai_client(model: str, **kwargs) -> Any:
    """Factory function to create OpenAI clients."""
    try:
        from openai import OpenAI
        return OpenAI(**kwargs)
    except ImportError:
        raise ImportError("OpenAI package not installed. Run: pip install openai")

@register_adapter(
    identifier=lambda client: client.__class__.__module__.startswith("openai"),
    priority=20,
    name="openai",
    provider="openai",
    client_factory=_create_openai_client,
    dependencies=["openai"]
)
class OpenAIAdapter(BaseLLMAdapter):
    """Adapter for OpenAI client objects."""

    def generate_text(self, prompt, instruction=None, **kwargs):
        # Implementation for OpenAI text generation
        messages = [{"role": "user", "content": prompt}]
        if instruction:
            messages.insert(0, {"role": "system", "content": instruction})

        response = self.client.chat.completions.create(
            model=kwargs.get("model", "gpt-3.5-turbo"),
            messages=messages,
            **{k: v for k, v in kwargs.items() if k != "model"}
        )
        return response.choices[0].message.content

    async def agenerate_text(self, prompt, instruction=None, **kwargs):
        # Implementation for async OpenAI text generation
        return self.generate_text(prompt, instruction, **kwargs)

    def generate_object(self, prompt, schema, instruction=None, **kwargs):
        # Implementation for OpenAI structured output
        import json
        structured_prompt = self._build_structured_instruction(prompt, schema, instruction)
        text = self.generate_text(structured_prompt, None, **kwargs)
        try:
            data = json.loads(text)
            return StructuredOutput(data=data, schema=schema)
        except json.JSONDecodeError:
            return StructuredOutput(data={}, schema=schema)

    async def agenerate_object(self, prompt, schema, instruction=None, **kwargs):
        # Implementation for async OpenAI structured output
        return self.generate_object(prompt, schema, instruction, **kwargs)
'''


def create_example_anthropic_adapter() -> str:
    """
    Return example code for creating an Anthropic adapter with provider support.
    """
    return '''
def _create_anthropic_client(model: str, **kwargs) -> Any:
    """Factory function to create Anthropic clients."""
    try:
        from anthropic import Anthropic
        return Anthropic(**kwargs)
    except ImportError:
        raise ImportError("Anthropic package not installed. Run: pip install anthropic")

@register_adapter(
    identifier=lambda client: client.__class__.__module__.startswith("anthropic"),
    priority=20,
    name="anthropic",
    provider="anthropic",
    client_factory=_create_anthropic_client,
    dependencies=["anthropic"]
)
class AnthropicAdapter(BaseLLMAdapter):
    """Adapter for Anthropic client objects."""

    def generate_text(self, prompt, instruction=None, **kwargs):
        # Implementation for Anthropic text generation
        messages = [{"role": "user", "content": prompt}]
        if instruction:
            messages.insert(0, {"role": "user", "content": instruction})

        response = self.client.messages.create(
            model=kwargs.get("model", "claude-3-sonnet-20240229"),
            messages=messages,
            max_tokens=kwargs.get("max_tokens", 1000),
            **{k: v for k, v in kwargs.items() if k not in ["model", "max_tokens"]}
        )
        return response.content[0].text

    async def agenerate_text(self, prompt, instruction=None, **kwargs):
        # Implementation for async Anthropic text generation
        return self.generate_text(prompt, instruction, **kwargs)

    def generate_object(self, prompt, schema, instruction=None, **kwargs):
        # Implementation for Anthropic structured output
        import json
        structured_prompt = self._build_structured_instruction(prompt, schema, instruction)
        text = self.generate_text(structured_prompt, None, **kwargs)
        try:
            data = json.loads(text)
            return StructuredOutput(data=data, schema=schema)
        except json.JSONDecodeError:
            return StructuredOutput(data={}, schema=schema)

    async def agenerate_object(self, prompt, schema, instruction=None, **kwargs):
        # Implementation for async Anthropic structured output
        return self.generate_object(prompt, schema, instruction, **kwargs)
'''

"""
Universal LLM Wrapper for Phoenix Evals

This module provides a unified interface for various LLM SDKs and model objects,
allowing users to work with different LLM providers through a consistent API.

Features an elegant adapter registry system that automatically detects and delegates
to the appropriate adapter based on client characteristics.
"""

import logging
import threading
from abc import ABC, abstractmethod
from dataclasses import dataclass
from enum import Enum
from typing import Any, Callable, Dict, List, Optional, Tuple, Type, Union

from phoenix.evals.models.base import BaseModel
from phoenix.evals.templates import MultimodalPrompt

logger = logging.getLogger(__name__)


@dataclass
class AdapterRegistration:
    """Registration information for an adapter."""
    adapter_class: Type["BaseLLMAdapter"]
    identifier: Callable[[Any], bool]
    priority: int
    name: str


@dataclass
class ProviderRegistration:
    """Registration information for a provider."""
    provider: str
    adapter_class: Type["BaseLLMAdapter"]
    client_factory: Callable[..., Any]
    dependencies: List[str]


# Global adapter registry
class AdapterRegistry:
    """Thread-safe registry for LLM adapters with client detection."""

    def __init__(self):
        self._adapters: List[AdapterRegistration] = []
        self._lock = threading.RLock()

    def register_adapter(
        self,
        adapter_class: Type["BaseLLMAdapter"],
        identifier: Callable[[Any], bool],
        priority: int = 10,
        name: str = "",
    ) -> None:
        """Register an adapter with its identification function."""
        with self._lock:
            if not name:
                name = adapter_class.__name__

            registration = AdapterRegistration(
                adapter_class=adapter_class,
                identifier=identifier,
                priority=priority,
                name=name,
            )

            self._adapters.append(registration)
            # Sort by priority (higher priority first)
            self._adapters.sort(key=lambda x: x.priority, reverse=True)

    def find_adapter(self, client: Any) -> Optional[Type["BaseLLMAdapter"]]:
        """Find the best matching adapter for the given client."""
        with self._lock:
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

    def list_adapters(self) -> List[Tuple[str, int]]:
        """List all registered adapters with their priorities."""
        with self._lock:
            return [(reg.name, reg.priority) for reg in self._adapters]


# Global provider registry
class ProviderRegistry:
    """Thread-safe registry for provider-based client instantiation."""

    def __init__(self):
        self._providers: Dict[str, List[ProviderRegistration]] = {}
        self._lock = threading.RLock()

    def register_provider(
        self,
        provider: str,
        adapter_class: Type["BaseLLMAdapter"],
        client_factory: Callable[..., Any],
        dependencies: Optional[List[str]] = None,
    ) -> None:
        """Register a provider with its client factory and target adapter."""
        with self._lock:
            registration = ProviderRegistration(
                provider=provider,
                adapter_class=adapter_class,
                client_factory=client_factory,
                dependencies=dependencies or [],
            )

            if provider not in self._providers:
                self._providers[provider] = []

            self._providers[provider].append(registration)

    def create_client(self, provider: str, model: str, **kwargs) -> Any:
        """Create a client for the specified provider and model."""
        with self._lock:
            provider_registrations = self._providers.get(provider)
            if not provider_registrations:
                available_providers = list(self._providers.keys())
                raise ValueError(
                    f"Unknown provider '{provider}'. Available providers: {available_providers}"
                )

            # Use the first available registration (could be enhanced with selection logic)
            registration = provider_registrations[0]

            # Check dependencies
            self._check_dependencies(registration)

            # Create client using factory
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

        missing_deps = []
        for dep in registration.dependencies:
            try:
                __import__(dep)
            except ImportError:
                missing_deps.append(dep)

        if missing_deps:
            deps_str = ", ".join(missing_deps)
            raise ImportError(
                f"Missing required dependencies for provider '{registration.provider}': {deps_str}. "
                f"Please install them with: pip install {' '.join(missing_deps)}"
            )

    def list_providers(self) -> List[str]:
        """List all available providers."""
        with self._lock:
            return list(self._providers.keys())

    def get_provider_registrations(self, provider: str) -> List[ProviderRegistration]:
        """Get all registrations for a specific provider."""
        with self._lock:
            return self._providers.get(provider, [])


# Global registry instances
_adapter_registry = AdapterRegistry()
_provider_registry = ProviderRegistry()


def register_adapter(
    identifier: Callable[[Any], bool],
    priority: int = 10,
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
            priority=10,
            name="langchain"
        )
        class LangChainModelAdapter(BaseLLMAdapter):
            pass
    """

    def decorator(adapter_class: Type["BaseLLMAdapter"]) -> Type["BaseLLMAdapter"]:
        _adapter_registry.register_adapter(adapter_class, identifier, priority, name)
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
        _provider_registry.register_provider(provider, adapter_class, client_factory, dependencies)
        return adapter_class

    return decorator


class OutputType(str, Enum):
    """Supported output types from LLM models."""

    TEXT = "text"
    TOOL_CALL = "tool_call"
    STRUCTURED = "structured"


@dataclass
class ToolCall:
    """Represents a tool/function call from the model."""

    name: str
    arguments: Dict[str, Any]
    id: Optional[str] = None


@dataclass
class StructuredOutput:
    """Represents structured/JSON output from the model."""

    data: Dict[str, Any]
    schema: Optional[Dict[str, Any]] = None


@dataclass
class LLMResponse:
    """Unified response object supporting different output types."""

    text: Optional[str] = None
    tool_calls: Optional[List[ToolCall]] = None
    structured_output: Optional[StructuredOutput] = None
    raw_response: Optional[Any] = None

    @property
    def output_type(self) -> OutputType:
        """Determine the primary output type of this response."""
        if self.tool_calls:
            return OutputType.TOOL_CALL
        elif self.structured_output:
            return OutputType.STRUCTURED
        else:
            return OutputType.TEXT


class BaseLLMAdapter(ABC):
    """
    Abstract base class that all SDK adapters must implement.

    Adapters only need to implement 4 core methods:
    - generate_text (sync text generation)
    - agenerate_text (async text generation)
    - generate_object (sync structured output)
    - agenerate_object (async structured output)

    The adapter is responsible for handling all implementation details including
    tool calling, structured output, and fallback mechanisms internally.
    """

    def __init__(self, client: Any):
        """Initialize adapter with the underlying SDK client/model."""
        self.client = client

    @abstractmethod
    def generate_text(
        self, prompt: Union[str, MultimodalPrompt], instruction: Optional[str] = None, **kwargs: Any
    ) -> str:
        """Generate text response from the model."""
        pass

    @abstractmethod
    async def agenerate_text(
        self, prompt: Union[str, MultimodalPrompt], instruction: Optional[str] = None, **kwargs: Any
    ) -> str:
        """Async version of generate_text."""
        pass

    @abstractmethod
    def generate_object(
        self,
        prompt: Union[str, MultimodalPrompt],
        schema: Dict[str, Any],
        instruction: Optional[str] = None,
        **kwargs: Any,
    ) -> StructuredOutput:
        """
        Generate structured output conforming to the provided schema.

        The adapter handles all implementation details internally (native structured output,
        tool calling, text parsing, etc.).
        """
        pass

    @abstractmethod
    async def agenerate_object(
        self,
        prompt: Union[str, MultimodalPrompt],
        schema: Dict[str, Any],
        instruction: Optional[str] = None,
        **kwargs: Any,
    ) -> StructuredOutput:
        """Async version of generate_object."""
        pass

    @property
    def model_name(self) -> str:
        """Return the name/identifier of the underlying model."""
        return f"{type(self).__name__}-{type(self.client).__name__}"


def _create_langchain_client(model: str, **kwargs) -> Any:
    """Factory function to create LangChain clients."""
    try:
        from langchain_openai import ChatOpenAI

        # Default to ChatOpenAI for now, could be extended to support other LangChain models
        return ChatOpenAI(model=model, **kwargs)
    except ImportError:
        try:
            from langchain.llms import OpenAI

            return OpenAI(model_name=model, **kwargs)
        except ImportError:
            raise ImportError(
                "LangChain package not installed. Run: pip install langchain langchain-openai"
            )


def _create_openai_langchain_client(model: str, **kwargs) -> Any:
    """Factory function to create LangChain OpenAI clients."""
    try:
        from langchain_openai import ChatOpenAI
        return ChatOpenAI(model=model, **kwargs)
    except ImportError:
        raise ImportError("LangChain OpenAI package not installed. Run: pip install langchain-openai")


def _create_anthropic_langchain_client(model: str, **kwargs) -> Any:
    """Factory function to create LangChain Anthropic clients."""
    try:
        from langchain_anthropic import ChatAnthropic
        return ChatAnthropic(model=model, **kwargs)
    except ImportError:
        raise ImportError("LangChain Anthropic package not installed. Run: pip install langchain-anthropic")


@register_adapter(
    identifier=lambda client: (
        hasattr(client, "__module__")
        and client.__module__ is not None
        and (
            "langchain" in client.__module__
            or (hasattr(client, "invoke") or hasattr(client, "predict"))
        )
    ),
    priority=10,
    name="langchain",
)
@register_provider(
    provider="openai",
    client_factory=_create_openai_langchain_client,
    dependencies=["langchain", "langchain-openai"]
)
@register_provider(
    provider="anthropic",
    client_factory=_create_anthropic_langchain_client,
    dependencies=["langchain", "langchain-anthropic"]
)
@register_provider(
    provider="langchain",
    client_factory=_create_langchain_client,
    dependencies=["langchain"]
)
class LangChainModelAdapter(BaseLLMAdapter):
    """Adapter for LangChain model objects."""

    def __init__(self, client: Any):
        """Initialize adapter with validation."""
        super().__init__(client)
        self._validate_client()

    def _validate_client(self) -> None:
        """Validate that the client is a LangChain model."""
        # Check for common LangChain model methods
        if not (hasattr(self.client, "invoke") or hasattr(self.client, "predict")):
            raise ValueError(
                f"LangChainModelAdapter requires a LangChain model instance with 'invoke' or 'predict' method, "
                f"got {type(self.client)}"
            )

    def generate_text(
        self, prompt: Union[str, MultimodalPrompt], instruction: Optional[str] = None, **kwargs: Any
    ) -> str:
        """Generate text using the LangChain model."""
        if isinstance(prompt, MultimodalPrompt):
            prompt_text = prompt.to_text_only_prompt()
        else:
            prompt_text = prompt

        if instruction:
            prompt_text = f"{instruction}\n\n{prompt_text}"

        # Try different LangChain invocation methods
        if hasattr(self.client, "invoke"):
            response = self.client.invoke(prompt_text, **kwargs)
        elif hasattr(self.client, "predict"):
            response = self.client.predict(prompt_text, **kwargs)
        else:
            # Fallback to direct call
            response = self.client(prompt_text, **kwargs)

        # Handle different response types
        if hasattr(response, "content"):
            return response.content
        elif isinstance(response, str):
            return response
        else:
            return str(response)

    async def agenerate_text(
        self, prompt: Union[str, MultimodalPrompt], instruction: Optional[str] = None, **kwargs: Any
    ) -> str:
        """Async text generation using the LangChain model."""
        if isinstance(prompt, MultimodalPrompt):
            prompt_text = prompt.to_text_only_prompt()
        else:
            prompt_text = prompt

        if instruction:
            prompt_text = f"{instruction}\n\n{prompt_text}"

        # Try async methods
        if hasattr(self.client, "ainvoke"):
            response = await self.client.ainvoke(prompt_text, **kwargs)
        elif hasattr(self.client, "apredict"):
            response = await self.client.apredict(prompt_text, **kwargs)
        else:
            # Fallback to sync method
            response = self.generate_text(prompt, instruction, **kwargs)

        # Handle different response types
        if hasattr(response, "content"):
            return response.content
        elif isinstance(response, str):
            return response
        else:
            return str(response)

    def generate_object(
        self,
        prompt: Union[str, MultimodalPrompt],
        schema: Dict[str, Any],
        instruction: Optional[str] = None,
        **kwargs: Any,
    ) -> StructuredOutput:
        """
        Generate structured output using LangChain model.

        Falls back to tool calling if structured output is not natively supported.
        """
        # Check if the model supports structured output natively
        if hasattr(self.client, "with_structured_output"):
            try:
                # Try native structured output - use standardized instruction
                structured_prompt = self._build_structured_instruction(prompt, schema, instruction)
                structured_model = self.client.with_structured_output(schema)

                response = structured_model.invoke(structured_prompt, **kwargs)

                # Handle different response formats
                if isinstance(response, dict):
                    return StructuredOutput(data=response, schema=schema)
                else:
                    # Try to convert to dict
                    import json

                    if hasattr(response, "__dict__"):
                        data = response.__dict__
                    else:
                        data = json.loads(str(response))
                    return StructuredOutput(data=data, schema=schema)

            except Exception as e:
                logger.warning(f"Structured output failed: {e}, falling back to tool calling")

        # Final fallback: try to parse JSON from text response with standardized instruction
        structured_prompt = self._build_structured_instruction(prompt, schema, instruction)
        text = self.generate_text(structured_prompt, None, **kwargs)
        import json

        try:
            data = json.loads(text)
            return StructuredOutput(data=data, schema=schema)
        except (json.JSONDecodeError, TypeError):
            logger.warning("Failed to parse JSON from text response, returning empty object")
            return StructuredOutput(data={}, schema=schema)

    async def agenerate_object(
        self,
        prompt: Union[str, MultimodalPrompt],
        schema: Dict[str, Any],
        instruction: Optional[str] = None,
        **kwargs: Any,
    ) -> StructuredOutput:
        """
        Async generate structured output using LangChain model.

        Falls back to tool calling if structured output is not natively supported.
        """
        # Check if the model supports structured output natively
        if hasattr(self.client, "with_structured_output"):
            try:
                # Try native structured output - use standardized instruction
                structured_prompt = self._build_structured_instruction(prompt, schema, instruction)
                structured_model = self.client.with_structured_output(schema)

                if hasattr(structured_model, "ainvoke"):
                    response = await structured_model.ainvoke(structured_prompt, **kwargs)
                else:
                    response = structured_model.invoke(structured_prompt, **kwargs)

                # Handle different response formats
                if isinstance(response, dict):
                    return StructuredOutput(data=response, schema=schema)
                else:
                    # Try to convert to dict
                    import json

                    if hasattr(response, "__dict__"):
                        data = response.__dict__
                    else:
                        data = json.loads(str(response))
                    return StructuredOutput(data=data, schema=schema)

            except Exception as e:
                logger.warning(f"Async structured output failed: {e}, falling back to tool calling")

        # Final fallback: try to parse JSON from text response with standardized instruction
        structured_prompt = self._build_structured_instruction(prompt, schema, instruction)
        text = await self.agenerate_text(structured_prompt, None, **kwargs)
        import json

        try:
            data = json.loads(text)
            return StructuredOutput(data=data, schema=schema)
        except (json.JSONDecodeError, TypeError):
            logger.warning("Failed to parse JSON from async text response, returning empty object")
            return StructuredOutput(data={}, schema=schema)

    @property
    def model_name(self) -> str:
        """Return the LangChain model name."""
        if hasattr(self.client, "model_name"):
            return self.client.model_name
        elif hasattr(self.client, "model"):
            return self.client.model
        else:
            return f"langchain-{type(self.client).__name__}"

    def _build_structured_instruction(
        self,
        prompt: Union[str, MultimodalPrompt],
        schema: Dict[str, Any],
        instruction: Optional[str] = None,
    ) -> str:
        """
        Build a standardized instruction for structured output generation.

        This ensures consistent instruction format regardless of whether we're using
        native structured output, tool calling, or different SDK implementations.
        """
        if isinstance(prompt, MultimodalPrompt):
            prompt_text = prompt.to_text_only_prompt()
        else:
            prompt_text = prompt

        # Build the structured output instruction
        structured_instruction = (
            "You must respond with valid JSON that conforms to the provided schema. "
            "Do not include any additional text, explanations, or formatting outside of the JSON response."
        )

        # Add schema information if available
        if schema:
            import json

            try:
                schema_str = json.dumps(schema, indent=2)
                structured_instruction += f"\n\nRequired JSON Schema:\n{schema_str}"
            except (TypeError, ValueError):
                # If schema can't be serialized, provide a general instruction
                structured_instruction += (
                    f"\n\nThe response must conform to the provided schema structure."
                )

        # Combine with user instruction if provided
        if instruction:
            combined_instruction = f"{instruction}\n\n{structured_instruction}"
        else:
            combined_instruction = structured_instruction

        # Combine instruction with prompt
        return f"{combined_instruction}\n\n{prompt_text}"


class UniversalLLMWrapper(BaseModel):
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

        # Separate BaseModel kwargs from client factory kwargs
        base_model_kwargs = {}
        client_factory_kwargs = {}

        # Known BaseModel parameters
        base_model_params = {"default_concurrency", "_verbose", "_rate_limiter"}

        for key, value in kwargs.items():
            if key in base_model_params:
                base_model_kwargs[key] = value
            else:
                client_factory_kwargs[key] = value

        # Handle provider-based initialization
        if provider is not None:
            try:
                client = _provider_registry.create_client(provider, model, **client_factory_kwargs)
            except Exception as e:
                available_providers = _provider_registry.list_providers()
                raise ValueError(
                    f"Failed to create client for provider '{provider}': {e}\n"
                    f"Available providers: {available_providers}"
                ) from e

        # Find appropriate adapter for the client
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

        # Initialize BaseModel fields
        super().__init__(**base_model_kwargs)

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
        instruction: Optional[str] = None,
        **kwargs: Any,
    ) -> StructuredOutput:
        """Generate structured output using the adapter."""
        return self._adapter.generate_object(prompt, schema, instruction, **kwargs)

    async def agenerate_object(
        self,
        prompt: Union[str, MultimodalPrompt],
        schema: Dict[str, Any],
        instruction: Optional[str] = None,
        **kwargs: Any,
    ) -> StructuredOutput:
        """Async structured output using the adapter."""
        return await self._adapter.agenerate_object(prompt, schema, instruction, **kwargs)

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

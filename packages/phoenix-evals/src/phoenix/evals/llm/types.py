from abc import ABC, abstractmethod
from dataclasses import dataclass
from enum import Enum
from typing import Any, Callable, Dict, List, Optional, Type, Union

from phoenix.evals.legacy.templates import MultimodalPrompt

from .prompts import PromptLike

__all__ = [
    "ObjectGenerationMethod",
    "BaseLLMAdapter",
    "AdapterRegistration",
    "ProviderRegistration",
]


class ObjectGenerationMethod(str, Enum):
    AUTO = "auto"
    TOOL_CALLING = "tool_calling"
    STRUCTURED_OUTPUT = "structured_output"


class BaseLLMAdapter(ABC):
    """
    Abstract base class that all SDK adapters must implement.

    Adapters only need to implement 4 core methods:
    - generate_text (sync text generation)
    - async_generate_text (async text generation)
    - generate_object (sync structured output)
    - async_generate_object (async structured output)

    The adapter is responsible for handling all implementation details including
    tool calling, structured output, and fallback mechanisms internally.
    """

    def __init__(self, client: Any, model: str) -> None:
        """Initialize the adapter with a client."""
        self.client = client
        self.model = model  # store the model name since the client might not store it

    @classmethod
    @abstractmethod
    def client_name(cls) -> str:
        """Return the name of the client."""
        pass

    @abstractmethod
    def generate_text(self, prompt: Union[PromptLike, MultimodalPrompt], **kwargs: Any) -> str:
        """Generate text response from the model.

        Args:
            prompt: Either a string or a list of message dicts with 'role' and 'content' fields.
        """
        pass

    @abstractmethod
    async def async_generate_text(
        self, prompt: Union[PromptLike, MultimodalPrompt], **kwargs: Any
    ) -> str:
        """Async version of generate_text.

        Args:
            prompt: Either a string or a list of message dicts with 'role' and 'content' fields.
        """
        pass

    @abstractmethod
    def generate_object(
        self,
        prompt: Union[PromptLike, MultimodalPrompt],
        schema: Dict[str, Any],
        method: ObjectGenerationMethod = ObjectGenerationMethod.AUTO,
        **kwargs: Any,
    ) -> Dict[str, Any]:
        """
        Generate structured output conforming to the provided schema.

        The adapter handles all implementation details internally (native structured output,
        tool calling, text parsing, etc.).

        Args:
            prompt: Either a string or a list of message dicts with 'role' and 'content' fields.
            schema: JSON schema for the structured output.
            method: Method to use for generation (auto, tool_calling, structured_output).

        Returns:
            A dictionary containing the structured data that conforms to the provided schema.
        """
        pass

    @abstractmethod
    async def async_generate_object(
        self,
        prompt: Union[PromptLike, MultimodalPrompt],
        schema: Dict[str, Any],
        method: ObjectGenerationMethod = ObjectGenerationMethod.AUTO,
        **kwargs: Any,
    ) -> Dict[str, Any]:
        """
        Async version of generate_object.

        Args:
            prompt: Either a string or a list of message dicts with 'role' and 'content' fields.
            schema: JSON schema for the structured output.
            method: Method to use for generation (auto, tool_calling, structured_output).

        Returns:
            A dictionary containing the structured data that conforms to the provided schema.
        """
        pass

    @property
    def model_name(self) -> str:
        """Return the name/identifier of the underlying model."""
        return f"{type(self).__name__}-{type(self.client).__name__}"


@dataclass
class AdapterRegistration:
    adapter_class: Type["BaseLLMAdapter"]
    identifier: Callable[[Any], bool]
    name: str


@dataclass
class ProviderRegistration:
    provider: str
    adapter_class: Type["BaseLLMAdapter"]
    client_name: str
    client_factory: Callable[..., Any]
    get_rate_limit_errors: Optional[Callable[..., List[Type[Exception]]]]
    dependencies: List[str]

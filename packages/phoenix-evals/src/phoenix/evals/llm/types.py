from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any, Callable, Dict, List, Type, Union

from phoenix.evals.templates import MultimodalPrompt


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

    def __init__(self, client: Any) -> None:
        """Initialize the adapter with a client."""
        self.client = client

    @classmethod
    @abstractmethod
    def client_name(cls) -> str:
        """Return the name of the client."""
        pass

    @abstractmethod
    def generate_text(self, prompt: Union[str, MultimodalPrompt], **kwargs: Any) -> str:
        """Generate text response from the model."""
        pass

    @abstractmethod
    async def agenerate_text(self, prompt: Union[str, MultimodalPrompt], **kwargs: Any) -> str:
        """Async version of generate_text."""
        pass

    @abstractmethod
    def generate_object(
        self,
        prompt: Union[str, MultimodalPrompt],
        schema: Dict[str, Any],
        **kwargs: Any,
    ) -> Dict[str, Any]:
        """
        Generate structured output conforming to the provided schema.

        The adapter handles all implementation details internally (native structured output,
        tool calling, text parsing, etc.).

        Returns:
            A dictionary containing the structured data that conforms to the provided schema.
        """
        pass

    @abstractmethod
    async def agenerate_object(
        self,
        prompt: Union[str, MultimodalPrompt],
        schema: Dict[str, Any],
        **kwargs: Any,
    ) -> Dict[str, Any]:
        """
        Async version of generate_object.

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
    dependencies: List[str]

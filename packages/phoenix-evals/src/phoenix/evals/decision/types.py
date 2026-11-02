from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any, Callable, Dict, List, Optional, Type, Union

from ..llm.prompts import PromptLike

__all__ = [
    "BaseDecisionAdapter",
    "ProviderRegistration",
]


class BaseDecisionAdapter(ABC):
    """
    Abstract base class that all decision-model SDK adapters must implement.

    A decision model only answers typed questions and cannot generate free-form text, so
    adapters only need to implement classification:
    - generate_classification (sync)
    - async_generate_classification (async)

    The adapter is responsible for translating labels into the SDK's question type, issuing
    the request, and parsing the response into a plain dict.
    """

    def __init__(self, client: Any, model: str) -> None:
        """Initialize the adapter with a client."""
        self.client = client
        self.model = model

    @classmethod
    @abstractmethod
    def client_name(cls) -> str:
        """Return the name of the client."""
        pass

    @abstractmethod
    def generate_classification(
        self,
        prompt: PromptLike,
        labels: Union[List[str], Dict[str, str]],
        **kwargs: Any,
    ) -> Dict[str, Any]:
        """Classify a prompt by selecting exactly one of the labels.

        Args:
            prompt: Either a string or a list of message dicts with 'role' and 'content' fields.
            labels: Either a list of label strings, or a dict mapping each label to a description.

        Returns:
            A dict with a ``label`` key and an optional ``metadata`` key.
        """
        pass

    @abstractmethod
    async def async_generate_classification(
        self,
        prompt: PromptLike,
        labels: Union[List[str], Dict[str, str]],
        **kwargs: Any,
    ) -> Dict[str, Any]:
        """Async version of generate_classification."""
        pass

    @property
    def model_name(self) -> str:
        """Return the name/identifier of the underlying model."""
        return f"{type(self).__name__}-{type(self.client).__name__}"

    @staticmethod
    def _to_state(prompt: PromptLike) -> str:
        """Flatten a prompt into a single plain-text decision ``state``.

        - A string prompt passes through unchanged.
        - A message list is joined in order with a blank line between messages; roles are
          dropped, since decision models have none.
        - When a message's content is a list of parts, only text parts are kept (joined with
          a newline); image and file parts are not forwarded.
        - Empty pieces are skipped.
        """
        if isinstance(prompt, str):
            return prompt

        pieces: List[str] = []
        for message in prompt:
            content = message.get("content") if isinstance(message, dict) else None
            if isinstance(content, str):
                text = content
            elif isinstance(content, list):
                text = "\n".join(
                    part["text"]
                    for part in content
                    if isinstance(part, dict) and part.get("type") == "text" and part.get("text")
                )
            else:
                text = ""
            if text:
                pieces.append(text)
        return "\n\n".join(pieces)


@dataclass
class ProviderRegistration:
    provider: str
    adapter_class: Type["BaseDecisionAdapter"]
    client_name: str
    client_factory: Callable[..., Any]
    get_rate_limit_errors: Optional[Callable[..., List[Type[Exception]]]]
    dependencies: List[str]

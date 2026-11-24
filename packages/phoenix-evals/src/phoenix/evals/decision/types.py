from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any, Callable, Dict, List, Optional, Type

from .._criteria import (
    ClassificationCriterion,
    ClassificationFailure,
    ClassificationResponse,
    ClassificationResult,
    Name,
    TokenUsage,
)
from ..llm.prompts import PromptLike

__all__ = [
    "BaseDecisionAdapter",
    "ClassificationCriterion",
    "ClassificationFailure",
    "ClassificationResponse",
    "ClassificationResult",
    "Name",
    "ProviderRegistration",
    "TokenUsage",
]


class BaseDecisionAdapter(ABC):
    """
    Abstract base class that all decision-model SDK adapters must implement.

    A decision model only answers typed questions and cannot generate free-form text, so
    adapters only need to implement classification. Decision SDKs answer several named
    questions in a single batched request, so the adapter contract is the plural:
    - generate_classifications (sync)
    - async_generate_classifications (async)

    The adapter is responsible for translating each criterion into the SDK's question type,
    issuing one request, and parsing the response into a :class:`ClassificationResponse`.
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
    def generate_classifications(
        self,
        prompt: PromptLike,
        criteria: Dict[Name, ClassificationCriterion],
        **kwargs: Any,
    ) -> ClassificationResponse:
        """Answer several named classification questions about one prompt in a single request.

        Args:
            prompt: Either a string or a list of message dicts with 'role' and 'content' fields.
            criteria: The questions to answer, keyed by name; each has its ``labels`` and an
                optional ``instruction``.

        Returns:
            A :class:`ClassificationResponse`: one ``ClassificationResult`` per criterion (in the
            order given) and the request's token usage (``None`` if none reported).
        """
        pass

    @abstractmethod
    async def async_generate_classifications(
        self,
        prompt: PromptLike,
        criteria: Dict[Name, ClassificationCriterion],
        **kwargs: Any,
    ) -> ClassificationResponse:
        """Async version of :meth:`generate_classifications`."""
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

    def _to_input(self, prompt: PromptLike) -> Any:
        """The request input for this adapter. Defaults to the flattened state."""
        return self._to_state(prompt)


@dataclass
class ProviderRegistration:
    provider: str
    adapter_class: Type["BaseDecisionAdapter"]
    client_name: str
    client_factory: Callable[..., Any]
    get_rate_limit_errors: Optional[Callable[..., List[Type[Exception]]]]
    dependencies: List[str]

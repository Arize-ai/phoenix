from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any, Callable, Dict, List, Optional, Sequence, Type, Union

from .._criteria import ClassificationCriterion
from ..llm.prompts import PromptLike

__all__ = [
    "BaseDecisionAdapter",
    "ClassificationCriterion",
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

    @staticmethod
    def _assemble_fanout(
        criteria: Sequence[ClassificationCriterion], raw_results: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Combine the per-criterion single-classification results into the multi result.

        Token usage from each call is summed (so the DECISION span still records token counts
        on this fan-out path); ``usage`` is ``None`` only when no call reported any.
        """
        results = [
            {
                "name": criterion["name"],
                "label": result["label"],
                "metadata": result.get("metadata", {}),
            }
            for criterion, result in zip(criteria, raw_results)
        ]
        usages: List[Dict[str, Any]] = []
        for result in raw_results:
            usage = result.get("usage")
            if usage:
                usages.append(usage)
        aggregate: Optional[Dict[str, Any]] = None
        if usages:
            aggregate = {
                "input_tokens": sum(u.get("input_tokens") or 0 for u in usages),
                "output_tokens": sum(u.get("output_tokens") or 0 for u in usages),
            }
        return {"results": results, "usage": aggregate}

    def generate_classifications(
        self,
        prompt: PromptLike,
        criteria: Sequence[ClassificationCriterion],
        **kwargs: Any,
    ) -> Dict[str, Any]:
        """Answer several named classification questions about one prompt.

        Adapters whose SDK can batch questions in a single request should override this.
        The default fans out to one :meth:`generate_classification` call per criterion and sums
        their token usage.

        Note: each criterion's ``instructions`` is not forwarded, because the single-question
        :meth:`generate_classification` has no instructions parameter. Adapters that need to send
        per-question instructions must override this method.

        Returns:
            A dict with ``results`` (one ``{"name", "label", "metadata"}`` dict per criterion,
            in the order given) and ``usage`` (summed token usage, or ``None`` if none reported).
        """
        raw_results = [
            self.generate_classification(prompt, criterion["labels"], **kwargs)
            for criterion in criteria
        ]
        return self._assemble_fanout(criteria, raw_results)

    async def async_generate_classifications(
        self,
        prompt: PromptLike,
        criteria: Sequence[ClassificationCriterion],
        **kwargs: Any,
    ) -> Dict[str, Any]:
        """Async version of :meth:`generate_classifications`."""
        raw_results: List[Dict[str, Any]] = []
        for criterion in criteria:
            raw_results.append(
                await self.async_generate_classification(prompt, criterion["labels"], **kwargs)
            )
        return self._assemble_fanout(criteria, raw_results)

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

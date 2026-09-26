"""Decision models for classification evaluators, independent of text generation."""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Dict, Optional

from .llm import PromptLike


@dataclass(frozen=True)
class ClassificationResult:
    """A decision, optional label probabilities, and JSON-serializable model metadata.

    Use ``metadata['model']`` for the resolved model identifier when available.
    Probabilities, when supplied, must cover every choice with finite values in [0, 1].
    Decision models do not produce explanations.
    """

    label: str
    probabilities: Optional[Dict[str, float]] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


class EvaluationModel(ABC):
    """A classification-only backend accepted by evaluators through ``llm=``.

    Implement both execution modes without generating reasoning text. The prompt
    is already rendered; criteria map labels to optional descriptions. Provider
    errors should propagate to the caller.
    """

    @abstractmethod
    def classify(
        self, *, prompt: PromptLike, criteria: Dict[str, Optional[str]]
    ) -> ClassificationResult:
        """Select one of the supplied labels."""
        ...

    @abstractmethod
    async def async_classify(
        self, *, prompt: PromptLike, criteria: Dict[str, Optional[str]]
    ) -> ClassificationResult:
        """Select a label asynchronously."""
        ...

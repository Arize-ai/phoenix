from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Union

from typing_extensions import NotRequired, TypeAlias, TypedDict

__all__ = [
    "ClassificationResult",
    "ClassificationCriterion",
    "Name",
]

Name: TypeAlias = str
"""A criterion name; the key under which that criterion's answer is returned."""


class ClassificationCriterion(TypedDict):
    """A single named classification question sent to a classification backend.

    This is the backend-level view of a criterion, shared by every backend that can answer
    classification questions (decision models and LLMs). The richer, evaluator-level
    ``Criterion`` lives in ``phoenix.evals.evaluators``; keeping this lighter type in a leaf
    module avoids a circular import (the backends sit below ``evaluators`` in the import graph)
    and keeps adapters decoupled from the evaluator layer's scoring concerns.

    Keys:
        name: Question name; becomes the key used to look the answer back up.
        labels: Either a list of label strings, or a dict mapping each label to a description.
        instruction: Optional instruction for this one question (the criterion's instruction).
    """

    name: str
    labels: Union[List[str], Dict[str, str]]
    instruction: NotRequired[Optional[str]]


@dataclass(frozen=True)
class ClassificationResult:
    """One backend's answer to one named classification question.

    Returned (keyed by criterion name) by ``generate_classifications`` on both backends
    (decision models and LLMs). Kept in this leaf module alongside
    :class:`ClassificationCriterion` so every backend can build and return it without importing
    the evaluator layer, and so the evaluator reads a typed object instead of a loose dict.

    Attributes:
        name: The criterion name this answers; also the key it is returned under.
        label: The label the backend chose for this criterion.
        explanation: Per-criterion explanation when the backend produced one (LLM path);
            ``None`` for decision models, which return no explanation.
        metadata: Backend metadata for this answer (e.g. probabilities, model_id, confidence).
    """

    name: Name
    label: str
    explanation: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

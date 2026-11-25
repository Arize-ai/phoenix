from dataclasses import dataclass, field
from typing import Dict, Literal, Optional, Union

from typing_extensions import NotRequired, TypeAlias, TypedDict

__all__ = [
    "ClassificationCriterion",
    "ClassificationFailure",
    "ClassificationFailureKind",
    "ClassificationMetadata",
    "ClassificationResponse",
    "ClassificationResult",
    "Description",
    "Label",
    "Name",
    "Score",
    "TokenUsage",
]

Name: TypeAlias = str
"""A criterion name; the key under which that criterion's answer is returned."""

Label: TypeAlias = str
"""One of the labels a criterion classifies into."""

Description: TypeAlias = Optional[str]
"""A label's description, or ``None`` when the label has none."""

Score: TypeAlias = Union[float, int]
"""The numeric score a label maps to."""

ClassificationFailureKind = Literal["refusal", "invalid_label", "error"]


class ClassificationMetadata(TypedDict, total=False):
    """Backend-provided extras attached to a :class:`ClassificationResult` or
    :class:`ClassificationFailure`. Every key is optional: the LLM path reports none, decision
    models report ``probabilities`` and ``model_id`` (and ``confidence`` when the provider does).

    Keys:
        probabilities: Each label mapped to the probability the backend assigned it.
        model_id: The model that produced the answer (the resolved response model).
        confidence: The provider's confidence in the chosen label, when it reports one.
    """

    probabilities: Dict[Label, float]
    model_id: str
    confidence: float


class ClassificationCriterion(TypedDict):
    """A single named classification question sent to a classification backend.

    This is the backend-level view of a criterion, shared by every backend that can answer
    classification questions (decision models and LLMs). The richer, evaluator-level
    ``Criterion`` lives in ``phoenix.evals.evaluators``; keeping this lighter type in a leaf
    module avoids a circular import (the backends sit below ``evaluators`` in the import graph)
    and keeps adapters decoupled from the evaluator layer's scoring concerns.

    The question name is the mapping key under which this criterion is passed to
    ``generate_classifications`` (and the key its answer is returned under), so it is not
    repeated here.

    Keys:
        labels: Each label mapped to its description, or ``None`` when the label has none.
        instruction: Optional instruction for this one question (the criterion's instruction).
    """

    labels: Dict[Label, Description]
    instruction: NotRequired[Optional[str]]


@dataclass(frozen=True)
class ClassificationResult:
    """One backend's successful answer to one classification question.

    Returned (keyed by criterion name) by ``generate_classifications`` on both backends
    (decision models and LLMs). Kept in this leaf module alongside
    :class:`ClassificationCriterion` so every backend can build and return it without importing
    the evaluator layer, and so the evaluator reads a typed object instead of a loose dict.

    The criterion name is the key this is returned under, so it is not repeated here.

    Attributes:
        label: The label the backend chose for this criterion.
        explanation: Per-criterion explanation when the backend produced one (LLM path);
            ``None`` for decision models, which return no explanation.
        metadata: Backend metadata for this answer (e.g. probabilities, model_id, confidence).
    """

    label: str
    explanation: Optional[str] = None
    metadata: ClassificationMetadata = field(default_factory=ClassificationMetadata)


@dataclass(frozen=True)
class ClassificationFailure:
    """One criterion that could not be classified, returned in place of a
    :class:`ClassificationResult` so that the other criteria's results are preserved.

    Attributes:
        kind: Why the classification failed (see :data:`ClassificationFailureKind`).
        reason: A human-readable explanation of the failure.
        metadata: Any backend metadata available for the failed criterion (e.g. model_id).
    """

    kind: ClassificationFailureKind
    reason: str
    metadata: ClassificationMetadata = field(default_factory=ClassificationMetadata)


@dataclass(frozen=True)
class TokenUsage:
    """Token counts a backend reports for a request. Both default to ``0`` (also used when the
    backend reports no usage) so usage sums cleanly across requests."""

    input_tokens: int = 0
    output_tokens: int = 0


@dataclass(frozen=True)
class ClassificationResponse:
    """What a classification backend's ``generate_classifications`` returns: one outcome per
    criterion (a :class:`ClassificationResult` or a :class:`ClassificationFailure`) plus the
    request's token usage.

    Attributes:
        results: One outcome per criterion, keyed by criterion name. A criterion that could
            not be classified maps to a :class:`ClassificationFailure` instead of a
            :class:`ClassificationResult`, so one failure does not discard the others.
        usage: Token usage for the request; zero counts when the backend reported none.
    """

    results: Dict[Name, Union[ClassificationResult, ClassificationFailure]]
    usage: TokenUsage = field(default_factory=TokenUsage)

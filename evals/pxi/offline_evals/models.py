from __future__ import annotations

from collections.abc import Callable, Sequence
from dataclasses import dataclass, field
from typing import Any, Literal

from phoenix.client.__generated__ import v1

from phoenix.db.types.annotation_configs import OptimizationDirection

TargetLevel = Literal["span", "trace", "session"]


@dataclass(frozen=True)
class EvaluationResult:
    score: float
    label: str | None = None
    explanation: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


EvaluateArtifact = Callable[[v1.Span, Sequence[v1.Span]], EvaluationResult | None]
AppliesToArtifact = Callable[[v1.Span, Sequence[v1.Span]], bool]


def always_applies(_: v1.Span, __: Sequence[v1.Span]) -> bool:
    return True


def no_required_env() -> tuple[str, ...]:
    return ()


@dataclass(frozen=True)
class EvaluatorSpec:
    """The small amount of scheduling policy that varies by evaluator."""

    name: str
    target: TargetLevel
    root_span_name: str
    evaluate: EvaluateArtifact
    applies_to: AppliesToArtifact = always_applies
    annotator_kind: Literal["CODE", "LLM"] = "CODE"
    sample_rate: float = 1.0
    identifier: str = "pxi-offline-evals"
    optimization_direction: OptimizationDirection = OptimizationDirection.NONE
    required_env_fn: Callable[[], tuple[str, ...]] = no_required_env
    """Env vars that must be set for this evaluator to run (e.g. LLM API keys)."""

    def __post_init__(self) -> None:
        if not 0.0 <= self.sample_rate <= 1.0:
            raise ValueError("sample_rate must be between 0 and 1")


@dataclass
class RunSummary:
    discovered: int = 0
    already_annotated: int = 0
    sampled_out: int = 0
    not_applicable: int = 0
    evaluated: int = 0
    errors: int = 0
    annotations: int = 0

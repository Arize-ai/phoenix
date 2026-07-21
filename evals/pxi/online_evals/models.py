from __future__ import annotations

from collections.abc import Awaitable, Callable, Sequence
from dataclasses import dataclass
from typing import Literal, Optional

from phoenix.client.__generated__ import v1
from phoenix.evals.evaluators import Score

EvaluateArtifact = Callable[[v1.Span, Sequence[v1.Span]], Awaitable[Optional[Score]]]
"""Evaluate one turn given its root span and every hydrated span in its trace.

Returns a :class:`phoenix.evals.evaluators.Score`, or ``None`` when the turn
is not applicable to this evaluator.
"""


@dataclass(frozen=True)
class EvaluatorSpec:
    """The scheduling policy that varies by evaluator.

    Everything else — applicability, judge configuration, input extraction —
    lives inside the ``evaluate`` function itself. LLM evaluators
    (``annotator_kind="LLM"``) share one judge provider/model (see
    :mod:`evals.pxi.online_evals.judge`); the runner validates the judge
    credentials for them and appends ``provider:model`` to their checkpoint
    identifier so a model change starts a new result series.
    """

    name: str
    root_span_name: str
    evaluate: EvaluateArtifact
    annotator_kind: Literal["CODE", "LLM"] = "CODE"
    sample_rate: float = 1.0
    identifier: str = "pxi-online-evals"
    """Versioned checkpoint identity; bump ``vN`` when scoring semantics change."""

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

from __future__ import annotations

from collections.abc import Awaitable, Callable, Sequence
from dataclasses import dataclass
from typing import Literal, Optional

from phoenix.client.__generated__ import v1
from phoenix.evals.evaluators import Score

EvaluateArtifact = Callable[[v1.Span, Sequence[v1.Span]], Awaitable[Optional[Score]]]
"""Evaluate one target span given every hydrated span in its trace.

The first argument is the span the annotation will be written to — a turn
root for turn-level evaluators, or an inner span (for example a TOOL span)
for evaluators that score individual actions. The second argument is every
hydrated span in that target's trace, so an evaluator can always reconstruct
the surrounding turn.

Returns a :class:`phoenix.evals.evaluators.Score`, or ``None`` when the
target is not applicable to this evaluator.
"""


@dataclass(frozen=True)
class SpanSelector:
    """Which spans an evaluator targets, expressed as ``get_spans`` filters.

    Selectors are frozen and hashable so the runner can group evaluators that
    want identical candidates and issue one discovery query per group.
    """

    names: tuple[str, ...]
    """Span names to discover; at least one is required so discovery is bounded."""

    span_kinds: tuple[str, ...] = ()
    """Optional span kinds (``AGENT``, ``TOOL``, ...); empty omits the filter."""

    parent_id: Optional[str] = None
    """``"null"`` selects root spans only; ``None`` omits the filter entirely."""

    def __init__(
        self,
        *,
        names: Sequence[str],
        span_kinds: Sequence[str] = (),
        parent_id: Optional[str] = None,
    ) -> None:
        if not names:
            raise ValueError("names must contain at least one span name")
        object.__setattr__(self, "names", tuple(names))
        object.__setattr__(self, "span_kinds", tuple(span_kinds))
        object.__setattr__(self, "parent_id", parent_id)

    def matches(self, span: v1.Span) -> bool:
        """Whether a discovered span belongs to this selector.

        Discovery groups selectors, so one query's results must be split back
        out per evaluator; the server already applied these filters, but the
        runner re-checks locally rather than trusting positional bookkeeping.
        """
        if span["name"] not in self.names:
            return False
        if self.span_kinds and span.get("span_kind") not in self.span_kinds:
            return False
        if self.parent_id == "null" and span.get("parent_id") is not None:
            return False
        return True


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
    selector: SpanSelector
    """Which spans this evaluator targets and annotates."""

    evaluate: EvaluateArtifact
    annotator_kind: Literal["CODE", "LLM"]
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

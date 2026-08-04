from __future__ import annotations

from collections.abc import Awaitable, Callable, Mapping, Sequence
from dataclasses import dataclass, field
from types import MappingProxyType
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

    names: tuple[str, ...] = ()
    """Span names to discover; empty omits the filter."""

    span_kinds: tuple[str, ...] = ()
    """Optional span kinds (``AGENT``, ``TOOL``, ...); empty omits the filter."""

    parent_id: Optional[str] = None
    """``"null"`` selects root spans only; ``None`` omits the filter entirely."""

    attributes: tuple[tuple[str, str], ...] = ()
    """Exact attribute matches, AND-ed together; empty omits the filter.

    Stored as pairs rather than a mapping to keep the selector hashable. This
    lets an evaluator target spans by what they *record* rather than by which
    tool produced them — for example every span carrying an approval decision,
    without naming the approval-gated tools.
    """

    def __init__(
        self,
        *,
        names: Sequence[str] = (),
        span_kinds: Sequence[str] = (),
        parent_id: Optional[str] = None,
        attributes: Mapping[str, str] = MappingProxyType({}),
    ) -> None:
        if any(not isinstance(name, str) or not name for name in names):
            raise ValueError("names must contain only non-empty span names")
        if any(not key for key in attributes):
            raise ValueError("attributes must contain only non-empty keys")
        if not names and not attributes:
            # Without one of these, discovery would sweep every span in the
            # window and blow through the runner's candidate safety limit.
            raise ValueError("a selector needs at least one name or attribute filter")
        object.__setattr__(self, "names", tuple(names))
        object.__setattr__(self, "span_kinds", tuple(span_kinds))
        object.__setattr__(self, "parent_id", parent_id)
        object.__setattr__(self, "attributes", tuple(sorted(attributes.items())))

    def matches(self, span: v1.Span) -> bool:
        """Whether a discovered span belongs to this selector.

        Discovery groups selectors, so one query's results must be split back
        out per evaluator; the server already applied these filters, but the
        runner re-checks locally rather than trusting positional bookkeeping.
        """
        if self.names and span["name"] not in self.names:
            return False
        if self.span_kinds and span.get("span_kind") not in self.span_kinds:
            return False
        if self.attributes:
            span_attributes = span.get("attributes", {})
            if any(span_attributes.get(key) != value for key, value in self.attributes):
                return False
        if self.parent_id is not None:
            expected_parent_id = None if self.parent_id == "null" else self.parent_id
            if span.get("parent_id") != expected_parent_id:
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
    not_applicable_reasons: dict[str, int] = field(default_factory=dict)

    def record_not_applicable(self, reason: str) -> None:
        self.not_applicable += 1
        self.not_applicable_reasons[reason] = self.not_applicable_reasons.get(reason, 0) + 1

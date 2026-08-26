from __future__ import annotations

from collections.abc import Awaitable, Callable, Mapping, Sequence
from dataclasses import dataclass, field
from typing import Literal, Optional

from phoenix.client.__generated__ import v1
from phoenix.evals.evaluators import Score

EvaluateArtifact = Callable[[v1.Span, Sequence[v1.Span]], Awaitable[Optional[Score]]]
"""Evaluate a target span with all hydrated spans from its trace."""


@dataclass(frozen=True)
class SpanSelector:
    """Hashable ``get_spans`` filters used for evaluator target discovery."""

    names: tuple[str, ...] = ()

    span_kinds: tuple[str, ...] = ()

    parent_id: Optional[str] = None

    attributes: tuple[tuple[str, str], ...] = ()

    def __init__(
        self,
        *,
        names: Sequence[str] = (),
        span_kinds: Sequence[str] = (),
        parent_id: Optional[str] = None,
        attributes: Mapping[str, str] | None = None,
    ) -> None:
        if attributes is None:
            attributes = {}
        if any(not isinstance(name, str) or not name for name in names):
            raise ValueError("names must contain only non-empty span names")
        if any(not isinstance(kind, str) or not kind for kind in span_kinds):
            raise ValueError("span_kinds must contain only non-empty strings")
        if any(not isinstance(key, str) or not key for key in attributes):
            raise ValueError("attributes must contain only non-empty keys")
        if any(not isinstance(value, str) for value in attributes.values()):
            raise ValueError("attributes must contain only string values")
        if not names and not attributes:
            raise ValueError("a selector needs at least one name or attribute filter")
        object.__setattr__(self, "names", tuple(names))
        object.__setattr__(self, "span_kinds", tuple(span_kinds))
        object.__setattr__(self, "parent_id", parent_id)
        object.__setattr__(self, "attributes", tuple(sorted(attributes.items())))

    def matches(self, span: v1.Span) -> bool:
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
    """An evaluator and its scheduling and checkpoint policy."""

    name: str
    selector: SpanSelector

    evaluate: EvaluateArtifact
    annotator_kind: Literal["CODE", "LLM"]
    sample_rate: float = 1.0
    identifier: str = "pxi-online-evals"

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

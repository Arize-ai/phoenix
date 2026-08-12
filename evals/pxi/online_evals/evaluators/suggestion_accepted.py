"""Annotate manual approval decisions on suggestion TOOL spans."""

from __future__ import annotations

from collections.abc import Sequence
from typing import Any

from phoenix.client.__generated__ import v1
from phoenix.evals.evaluators import Score

from evals.pxi.online_evals.models import EvaluatorSpec, SpanSelector

ANNOTATION_NAME = "suggestion_accepted"

APPROVAL_DECISION_ATTRIBUTE = "pxi.approval.decision"
APPROVAL_SOURCE_ATTRIBUTE = "pxi.approval.source"
USER_APPROVAL_SOURCE = "user"

DECISION_SCORES: dict[str, float] = {
    "accepted": 1.0,
    "rejected": 0.0,
}


def _tool_name(span: v1.Span) -> str:
    value: Any = span.get("attributes", {}).get("tool.name")
    return value if isinstance(value, str) and value else span["name"]


async def evaluate_suggestion_accepted(target: v1.Span, _spans: Sequence[v1.Span]) -> Score | None:
    attributes = target.get("attributes", {})
    if attributes.get(APPROVAL_SOURCE_ATTRIBUTE) != USER_APPROVAL_SOURCE:
        return None
    recorded: Any = attributes.get(APPROVAL_DECISION_ATTRIBUTE)
    score = DECISION_SCORES.get(recorded) if isinstance(recorded, str) else None
    if score is None:
        return None
    tool_name = _tool_name(target)
    return Score(
        name=ANNOTATION_NAME,
        score=score,
        label=recorded,
        explanation=f"user {recorded} the {tool_name} suggestion",
        metadata={"tool_name": tool_name},
        kind="code",
    )


SUGGESTION_ACCEPTED = EvaluatorSpec(
    name=ANNOTATION_NAME,
    selector=SpanSelector(
        span_kinds=("TOOL",),
        attributes={APPROVAL_SOURCE_ATTRIBUTE: USER_APPROVAL_SOURCE},
    ),
    evaluate=evaluate_suggestion_accepted,
    annotator_kind="CODE",
    sample_rate=1.0,
    identifier="pxi-online-evals:suggestion-accepted:v1",
)

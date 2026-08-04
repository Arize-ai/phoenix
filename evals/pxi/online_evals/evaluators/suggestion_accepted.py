"""Online `suggestion_accepted` evaluator: did the user accept this suggestion?

PXI proposes some changes behind an approval gate: the tool stages an edit,
the UI renders an accept/reject card, and the user's click is recorded in that
TOOL span's approval attributes. This evaluator turns those recorded decisions
into a deterministic CODE annotation on the TOOL span itself.

Approval-gated tools stamp their decision into their tool output, and the
server promotes it onto the span as ``pxi.approval.decision`` /
``pxi.approval.source`` (see ``src/phoenix/server/agents/approval.py`` and
``app/src/agent/shared/pendingApproval/approvalOutcome.ts``). Discovery and
classification both key off those attributes, so this evaluator needs no list
of approval-gated tool names: a newly gated tool is covered the day it ships.

It annotates **only manual user decisions**. Automatic accepts (edit permission
set to bypass) carry ``source="auto"`` and are excluded at discovery. Approvals
that were never decided — still pending, cancelled by navigation, or errored —
carry no marker at all, so they are never discovered either.

Targeting the TOOL span rather than the turn root is deliberate: one turn can
contain several suggestions that the user decides differently, and a
turn-level annotation would collapse them into a single label.
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Any

from evals.pxi.online_evals.models import EvaluatorSpec, SpanSelector
from phoenix.client.__generated__ import v1
from phoenix.evals.evaluators import Score

ANNOTATION_NAME = "suggestion_accepted"

# The server writes these attributes in its agents router. This evaluator reads
# them through the public span-attribute contract, not a server-internal module.
APPROVAL_DECISION_ATTRIBUTE = "pxi.approval.decision"
APPROVAL_SOURCE_ATTRIBUTE = "pxi.approval.source"
USER_APPROVAL_SOURCE = "user"

DECISION_SCORES: dict[str, tuple[str, float]] = {
    "accepted": ("accepted", 1.0),
    "rejected": ("rejected", 0.0),
}
"""Marker decision to ``(label, score)``. Unknown decisions are not applicable."""


def _tool_name(span: v1.Span) -> str:
    value: Any = span.get("attributes", {}).get("tool.name")
    return value if isinstance(value, str) and value else span["name"]


async def evaluate_suggestion_accepted(target: v1.Span, _spans: Sequence[v1.Span]) -> Score | None:
    attributes = target.get("attributes", {})
    # Re-checked locally rather than trusting the discovery filter, so the
    # evaluator is still correct if called with an arbitrary span.
    if attributes.get(APPROVAL_SOURCE_ATTRIBUTE) != USER_APPROVAL_SOURCE:
        return None
    recorded: Any = attributes.get(APPROVAL_DECISION_ATTRIBUTE)
    decision = DECISION_SCORES.get(recorded) if isinstance(recorded, str) else None
    if decision is None:
        return None
    label, score = decision
    tool_name = _tool_name(target)
    return Score(
        name=ANNOTATION_NAME,
        score=score,
        label=label,
        explanation=f"user {label} the {tool_name} suggestion",
        # Only the low-cardinality tool name: never prompt text, tool
        # arguments, raw output, user content, instance ids, or diffs.
        metadata={"tool_name": tool_name},
        kind="code",
    )


SUGGESTION_ACCEPTED = EvaluatorSpec(
    name=ANNOTATION_NAME,
    # Selecting on the approval source rather than the decision keeps discovery
    # to a single query and yields exactly the annotated set: user accepts and
    # user rejections, never an automatic bypass accept.
    selector=SpanSelector(
        span_kinds=("TOOL",),
        attributes={APPROVAL_SOURCE_ATTRIBUTE: USER_APPROVAL_SOURCE},
    ),
    evaluate=evaluate_suggestion_accepted,
    annotator_kind="CODE",
    sample_rate=1.0,
    identifier="pxi-online-evals:suggestion-accepted:v1",
)

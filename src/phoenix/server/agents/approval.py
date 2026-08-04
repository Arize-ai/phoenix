from __future__ import annotations

import json
from typing import Any

APPROVAL_DECISION_ATTRIBUTE = "pxi.approval.decision"
APPROVAL_SOURCE_ATTRIBUTE = "pxi.approval.source"

_APPROVAL_KEY = "approval"
_DECISIONS = frozenset({"accepted", "rejected"})
_SOURCES = frozenset({"user", "auto"})


def approval_attributes(result: Any) -> dict[str, str]:
    """Extract span attributes from an approval-gated tool's output, if present.

    Approval-gated PXI tools stamp a reserved ``approval`` marker into their
    accept/reject output (see
    ``app/src/agent/shared/pendingApproval/approvalOutcome.ts``)::

        {"approval": {"decision": "accepted", "source": "user"}}

    Promoting it onto the span lets consumers filter approval decisions
    server-side by attribute, instead of matching a hand-maintained list of tool
    names or scanning ``output.value`` payloads. Tool output that carries no
    marker — every non-gated tool, plus cancellations and still-pending
    proposals — yields no attributes.

    The result arrives either as a mapping or as a JSON string, depending on the
    tool. It originates in the browser, so every field is untrusted: anything
    unrecognized or malformed is ignored rather than raised. This is telemetry
    enrichment and must never fail a tool call.
    """
    marker = _marker(result)
    if marker is None:
        return {}
    decision = marker.get("decision")
    source = marker.get("source")
    # `x in frozenset` raises TypeError on unhashable values, so the isinstance
    # guards are load-bearing, not decoration — `decision` may be any JSON value.
    if not isinstance(decision, str) or decision not in _DECISIONS:
        return {}
    if not isinstance(source, str) or source not in _SOURCES:
        return {}
    return {
        APPROVAL_DECISION_ATTRIBUTE: decision,
        APPROVAL_SOURCE_ATTRIBUTE: source,
    }


def _marker(result: Any) -> dict[str, Any] | None:
    """The ``approval`` object from a tool result, or None if there isn't one."""
    if isinstance(result, str):
        try:
            result = json.loads(result)
        except (ValueError, TypeError):
            return None
    if not isinstance(result, dict):
        return None
    marker = result.get(_APPROVAL_KEY)
    return marker if isinstance(marker, dict) else None

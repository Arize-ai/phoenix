from __future__ import annotations

import json
from typing import Any

APPROVAL_DECISION_ATTRIBUTE = "pxi.approval.decision"
APPROVAL_SOURCE_ATTRIBUTE = "pxi.approval.source"

_APPROVAL_KEY = "approval"
_DECISIONS = frozenset({"accepted", "rejected"})
_SOURCES = frozenset({"user", "auto"})


def approval_attributes(result: Any) -> dict[str, str]:
    """Extract validated ``pxi.approval.*`` attributes from a client tool result."""
    marker = _marker(result)
    if marker is None:
        return {}
    decision = marker.get("decision")
    source = marker.get("source")
    # JSON values may be unhashable, so validate their types before set membership.
    if not isinstance(decision, str) or decision not in _DECISIONS:
        return {}
    if not isinstance(source, str) or source not in _SOURCES:
        return {}
    return {
        APPROVAL_DECISION_ATTRIBUTE: decision,
        APPROVAL_SOURCE_ATTRIBUTE: source,
    }


def _marker(result: Any) -> dict[str, Any] | None:
    if isinstance(result, str):
        try:
            result = json.loads(result)
        except (ValueError, TypeError):
            return None
    if not isinstance(result, dict):
        return None
    marker = result.get(_APPROVAL_KEY)
    return marker if isinstance(marker, dict) else None

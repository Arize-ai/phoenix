"""Response-envelope assembly for the span analytics MCP tools.

Everything a tool needs to turn raw query results into the response
contract lives here: the discriminated-union output schemas (``ok`` /
``validate`` / ``error`` arms), value serialization, and the two size
disciplines — per-string clipping for drill-down payloads and whole-row
budgeting for surveys. Whole values are never dropped silently: clipping
marks what it removed and points at the recovery path, and budgeting
reports how many rows fit.
"""

from __future__ import annotations

import json
from copy import deepcopy
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Sequence

from phoenix.server.mcp_span_analytics.compiler import TimeRange

#: Structural disclosure attached whenever a filter used an annotation
#: predicate: existence tests are any-annotator by construction.
ANNOTATION_SEMANTICS_NOTE = (
    "The filter's annotation predicate uses any-annotator semantics: any "
    "matching annotation row satisfies it; consensus or reduced semantics "
    "are not implemented."
)

ANNOTATION_SEMANTICS_SCHEMA: dict[str, Any] = {
    "type": "string",
    "enum": ["any"],
    "description": (
        "Present when the filter used an annotation predicate: the predicate "
        "is satisfied by any matching annotation row (any-annotator "
        "semantics); consensus/reduced semantics are not implemented."
    ),
}


# --------------------------------------------------------------------------
# Output schemas
# --------------------------------------------------------------------------

ERROR_ARM: dict[str, Any] = {
    "type": "object",
    "properties": {
        "status": {"const": "error"},
        "code": {
            "type": "string",
            "description": (
                "Machine-readable failure class, e.g. unknown_field, invalid_filter, "
                "invalid_shape, field_not_groupable, project_not_found."
            ),
        },
        "path": {
            "type": ["string", "null"],
            "description": "Request location the error anchors to, e.g. 'order[0].field'.",
        },
        "message": {"type": "string"},
        "suggestions": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Nearest-name or alternative-usage candidates, directly usable.",
        },
    },
    "required": ["status", "code", "message"],
}

VALIDATE_ARM: dict[str, Any] = {
    "type": "object",
    "properties": {
        "status": {"const": "ok"},
        "valid": {"const": True},
        "applied": {"type": "object"},
    },
    "required": ["status", "valid"],
}


def union_schema(
    ok_properties: dict[str, Any],
    ok_required: Sequence[str],
    validate_arm: bool = False,
) -> dict[str, Any]:
    """The discriminated-union output schema: an ``ok`` arm with the given
    properties, optionally the ``validate_only`` arm, and the error arm."""
    ok_arm: dict[str, Any] = {
        "type": "object",
        "properties": {"status": {"const": "ok"}, **ok_properties},
        "required": ["status", *ok_required],
    }
    arms = [ok_arm, *([VALIDATE_ARM] if validate_arm else []), ERROR_ARM]
    return {"type": "object", "oneOf": arms}


COLUMNS_SCHEMA: dict[str, Any] = {
    "type": "array",
    "items": {
        "type": "object",
        "properties": {
            "id": {"type": "string"},
            "type": {"type": "string"},
            "unit": {"type": ["string", "null"]},
        },
    },
    "description": "Typed metadata of the result columns, in order.",
}

GUIDANCE_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "cause": {
            "type": "string",
            "enum": ["window_empty", "path_not_observed", "no_matches"],
        },
        "detail": {"type": "string"},
    },
    "description": (
        "Present when the result is empty: which of the enumerated causes applies. "
        "path_not_observed is sampled evidence, not proof of absence."
    ),
}


# --------------------------------------------------------------------------
# Serialization
# --------------------------------------------------------------------------


def cell(value: Any) -> Any:
    """Serialize one result cell: datetimes as UTC ISO-8601, Decimals as
    floats, everything else unchanged."""
    if isinstance(value, datetime):
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc).isoformat()
    if isinstance(value, Decimal):
        return float(value)
    return value


def serialized_size(obj: Any) -> int:
    return len(json.dumps(obj, ensure_ascii=False, default=str))


def iso(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat()


def time_range_resolved(time_range: TimeRange) -> dict[str, str]:
    return {"start": iso(time_range.start), "end": iso(time_range.end)}


# --------------------------------------------------------------------------
# Size budgets
# --------------------------------------------------------------------------


def rows_within_budget(rows: Sequence[dict[str, Any]], budget: int) -> list[dict[str, Any]]:
    """Keep the leading rows that fit the character budget.

    Rows are kept whole, never truncated mid-record; at least one row is
    always kept so a too-small budget degrades to a single record instead
    of an empty result.
    """
    kept: list[dict[str, Any]] = []
    used = 0
    for row in rows:
        cost = serialized_size(row)
        if kept and used + cost > budget:
            break
        kept.append(row)
        used += cost
    return kept


def clip_strings_to_budget(
    obj: Any,
    budget: int,
    marker: str,
    min_keep: int = 500,
) -> tuple[Any, list[str]]:
    """Clip the largest string leaves of a JSON-like object until it fits.

    Returns the (possibly copied and clipped) object and the dotted paths of
    clipped leaves. Whole values are never dropped — clipping a cell and
    pointing at the recovery path degrades better than losing the row.
    """
    size = serialized_size(obj)
    if size <= budget:
        return obj, []
    obj = deepcopy(obj)
    leaves: list[tuple[int, Any, Any, str]] = []

    def collect(node: Any, path: str) -> None:
        if isinstance(node, dict):
            for key, value in node.items():
                child_path = f"{path}.{key}" if path else str(key)
                if isinstance(value, str) and len(value) > min_keep:
                    leaves.append((len(value), node, key, child_path))
                else:
                    collect(value, child_path)
        elif isinstance(node, list):
            for index, value in enumerate(node):
                child_path = f"{path}[{index}]"
                if isinstance(value, str) and len(value) > min_keep:
                    leaves.append((len(value), node, index, child_path))
                else:
                    collect(value, child_path)

    collect(obj, "")
    leaves.sort(key=lambda item: item[0], reverse=True)
    clipped: list[str] = []
    for length, container, key, path in leaves:
        if size <= budget:
            break
        text_value = container[key]
        excess = size - budget
        keep = max(min_keep, len(text_value) - excess - len(marker))
        if keep >= len(text_value):
            continue
        suffix = f"…[clipped {len(text_value) - keep} chars; {marker}]"
        container[key] = text_value[:keep] + suffix
        size += len(suffix) + keep - len(text_value)
        clipped.append(path)
    return obj, clipped

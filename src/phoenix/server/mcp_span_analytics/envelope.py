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

ANNOTATION_REDUCTIONS_SCHEMA: dict[str, Any] = {
    "type": "array",
    "items": {
        "type": "object",
        "properties": {
            "field": {"type": "string", "description": "The field id, as requested."},
            "annotation": {"type": "string", "description": "Annotation name reduced."},
            "annotator_kind": {
                "type": ["string", "null"],
                "description": "Annotator kind the reduction was restricted to, or null for all.",
            },
            "reduction": {
                "type": "string",
                "enum": ["mean_over_annotators", "latest_by_updated_at", "cardinality"],
            },
            "note": {"type": "string"},
        },
        "required": ["field", "annotation", "reduction"],
    },
    "description": (
        "Present when the query read annotation values through the spans grain: one "
        "entry per reduced field, naming the rule that collapsed a span's several "
        "annotations into one value. A reduced number means nothing without it."
    ),
}

ANNOTATION_COMPOSITION_NOTE = (
    "Rows carry annotation_composition: how many annotations of each annotator kind "
    "each group actually contained. A blended average moves when that mix moves, with "
    "no annotator having changed its scoring, so compare the composition across groups "
    "before reading a difference as a quality change."
)

ANNOTATION_COMPOSITION_SCHEMA: dict[str, Any] = {
    "type": "object",
    "description": (
        "Per annotation name, the count of contributing annotations by annotator kind "
        "('LLM', 'CODE', 'HUMAN'), for every reduction that was not already restricted "
        "to one kind. Kinds with no annotations are omitted."
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

#: One coherent per-field notes mechanism, shared by live responses
#: (``field_notes``) and validation (``warnings``): ``not_observed`` — the
#: path was not seen in the discovery sample (open admission stands, so
#: this is a disclosure with nearest-spelling suggestions, not an error);
#: ``all_null`` — the path was observed in the project but carries no
#: value anywhere in this result.
FIELD_NOTES_SCHEMA: dict[str, Any] = {
    "type": "array",
    "items": {
        "type": "object",
        "properties": {
            "field": {"type": "string", "description": "The path, in canonical query spelling."},
            "code": {"type": "string", "enum": ["not_observed", "all_null"]},
            "note": {"type": "string"},
            "suggestions": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Nearest observed spellings, directly usable.",
            },
        },
        "required": ["field", "code", "note"],
    },
    "description": (
        "Per-field admission and completeness notes: not_observed — the path was "
        "not seen in the discovery sample (sampled evidence, not proof of "
        "absence; suggestions name the nearest observed spellings); all_null — "
        "the path was observed in the project's sample but was NULL on every "
        "returned row or produced only a null group."
    ),
}

VALIDATE_ARM: dict[str, Any] = {
    "type": "object",
    "properties": {
        "status": {"const": "ok"},
        "valid": {"const": True},
        "applied": {"type": "object"},
        "warnings": FIELD_NOTES_SCHEMA,
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


def annotation_reductions(fields: Sequence[Any]) -> list[dict[str, Any]]:
    """Disclosure entries for the reduced fields a query used."""
    entries: list[dict[str, Any]] = []
    for field in fields:
        reference = getattr(field, "annotation", None)
        entries.append(
            {
                "field": field.id,
                "annotation": reference.name if reference is not None else None,
                "annotator_kind": reference.annotator_kind if reference is not None else None,
                "reduction": field.reduction,
                "note": field.description,
            }
        )
    return entries


def composition_map(
    probes: Sequence[Any],
    values: Sequence[Any],
) -> dict[str, dict[str, int]]:
    """Fold the hidden per-kind probe values into one nested count map.

    Zero counts are dropped: an annotator kind that wrote nothing is noise
    in every row, and its absence is what the caller needs to see.
    """
    composition: dict[str, dict[str, int]] = {}
    for probe, value in zip(probes, values):
        count = int(value or 0)
        if not count:
            continue
        composition.setdefault(probe.annotation_name, {})[probe.annotator_kind] = count
    return composition


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

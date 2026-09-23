from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any, Literal, Mapping, Sequence, cast

Archetype = Literal[
    "plain_chat",
    "rag",
    "tool_agent",
    "graph_multi_agent",
    "guardrailed",
    "structured_extraction",
]
ARCHETYPES = frozenset(
    {
        "plain_chat",
        "rag",
        "tool_agent",
        "graph_multi_agent",
        "guardrailed",
        "structured_extraction",
    }
)

_TRACE_ID_PATTERN = re.compile(r"[0-9a-fA-F]{32}")


@dataclass(frozen=True)
class Fragment:
    fragment_id: str
    archetype: Archetype
    domain: str
    trace_ids: tuple[str, ...]


class SchemaValidationError(ValueError):
    def __init__(self, field: str, message: str) -> None:
        self.field = field
        super().__init__(message)


def validate_fragment(value: Mapping[str, Any]) -> Fragment:
    fragment_id = _require_string(value, "fragment_id")
    archetype = _require_choice(value, "archetype", ARCHETYPES)
    domain = _require_string(value, "domain")
    raw_trace_ids = _require_sequence(value, "trace_ids")
    if not raw_trace_ids:
        raise SchemaValidationError("trace_ids", "must not be empty")
    trace_ids = []
    for index, trace_id in enumerate(raw_trace_ids):
        if not isinstance(trace_id, str) or _TRACE_ID_PATTERN.fullmatch(trace_id) is None:
            raise SchemaValidationError(
                f"trace_ids[{index}]", "must be a 32-character hexadecimal trace ID"
            )
        trace_ids.append(trace_id.lower())

    return Fragment(
        fragment_id=fragment_id,
        archetype=cast(Archetype, archetype),
        domain=domain,
        trace_ids=tuple(trace_ids),
    )


def _require_sequence(value: Mapping[str, Any], field: str) -> Sequence[Any]:
    item = value.get(field)
    if not isinstance(item, list):
        raise SchemaValidationError(field, "must be an array")
    return item


def _require_string(value: Mapping[str, Any], field: str) -> str:
    item = value.get(field)
    if not isinstance(item, str) or not item:
        raise SchemaValidationError(field, "must be a non-empty string")
    return item


def _require_choice(value: Mapping[str, Any], field: str, choices: frozenset[str]) -> str:
    item = value.get(field)
    if not isinstance(item, str) or item not in choices:
        raise SchemaValidationError(field, f"must be one of {sorted(choices)!r}")
    return item

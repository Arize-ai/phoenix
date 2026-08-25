from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any, Literal, Mapping, Sequence, TypedDict, cast

Archetype = Literal[
    "plain_chat",
    "rag",
    "tool_agent",
    "graph_multi_agent",
    "guardrailed",
    "structured_extraction",
]
QualityTier = Literal["high", "standard", "deliberately_bad"]
LengthBand = Literal["single_turn", "short", "medium", "long"]
GenerationLane = Literal["self_play", "scripted"]

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
QUALITY_TIERS = frozenset({"high", "standard", "deliberately_bad"})
LENGTH_BANDS = frozenset({"single_turn", "short", "medium", "long"})
GENERATION_LANES = frozenset({"self_play", "scripted"})

_TRACE_ID_PATTERN = re.compile(r"[0-9a-fA-F]{32}")


class FileMetadata(TypedDict):
    sha256: str
    size_bytes: int


class ScenarioManifestV2(TypedDict):
    schema_version: Literal[2]
    scenario_name: str
    generated_at: str
    generation_revision: str
    matrix_sha256: str
    matrix_seed: int
    fragment_count: int
    trace_count: int
    span_count: int
    span_kinds: Sequence[str]
    instrumenter_package_versions: Mapping[str, str]
    files: Mapping[str, FileMetadata]
    quality_gate_summary: Mapping[str, Any]


class ModelUsedRecord(TypedDict):
    role: str
    provider: str
    model: str


class FragmentRecordV2(TypedDict):
    fragment_id: str
    archetype: Archetype
    domain: str
    topic: str
    scenario_template: str
    persona: str
    register: str
    quality_tier: QualityTier
    failure_mode: str
    length_band: LengthBand
    lane: GenerationLane
    models_used: Sequence[ModelUsedRecord]
    turn_count: int
    trace_ids: Sequence[str]
    content_sha256: str
    quality_results: Mapping[str, Any]


@dataclass(frozen=True)
class ModelUsed:
    role: str
    provider: str
    model: str


@dataclass(frozen=True)
class Fragment:
    fragment_id: str
    archetype: Archetype
    domain: str
    trace_ids: tuple[str, ...]
    topic: Any = None
    scenario_template: Any = None
    persona: Any = None
    register: Any = None
    quality_tier: Any = None
    failure_mode: Any = None
    length_band: Any = None
    lane: Any = None
    models_used: tuple[ModelUsed, ...] = ()
    turn_count: Any = None
    content_sha256: Any = None
    quality_results: Mapping[str, Any] = field(default_factory=dict)


class SchemaValidationError(ValueError):
    def __init__(self, field: str, message: str) -> None:
        self.field = field
        super().__init__(message)


def validate_manifest_v2(value: Mapping[str, Any]) -> ScenarioManifestV2:
    _require_literal(value, "schema_version", 2)
    _require_string(value, "scenario_name")
    return cast(ScenarioManifestV2, value)


def validate_fragment_v2(value: Mapping[str, Any]) -> Fragment:
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

    raw_models = value.get("models_used")
    models = (
        tuple(
            ModelUsed(
                role=cast(str, raw_model.get("role", "")),
                provider=cast(str, raw_model.get("provider", "")),
                model=cast(str, raw_model.get("model", "")),
            )
            for raw_model in raw_models
            if isinstance(raw_model, Mapping)
        )
        if isinstance(raw_models, list)
        else ()
    )
    quality_results = value.get("quality_results")
    return Fragment(
        fragment_id=fragment_id,
        archetype=cast(Archetype, archetype),
        domain=domain,
        trace_ids=tuple(trace_ids),
        topic=value.get("topic"),
        scenario_template=value.get("scenario_template"),
        persona=value.get("persona"),
        register=value.get("register"),
        quality_tier=value.get("quality_tier"),
        failure_mode=value.get("failure_mode"),
        length_band=value.get("length_band"),
        lane=value.get("lane"),
        models_used=tuple(models),
        turn_count=value.get("turn_count"),
        content_sha256=value.get("content_sha256"),
        quality_results=quality_results if isinstance(quality_results, Mapping) else {},
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


def _require_literal(value: Mapping[str, Any], field: str, expected: Any) -> None:
    if value.get(field) != expected or type(value.get(field)) is not type(expected):
        raise SchemaValidationError(field, f"must be {expected!r}")


def _require_choice(value: Mapping[str, Any], field: str, choices: frozenset[str]) -> str:
    item = value.get(field)
    if not isinstance(item, str) or item not in choices:
        raise SchemaValidationError(field, f"must be one of {sorted(choices)!r}")
    return item

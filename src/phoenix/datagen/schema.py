from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime
from math import isfinite
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

_SHA256_PATTERN = re.compile(r"[0-9a-f]{64}")
_TRACE_ID_PATTERN = re.compile(r"[0-9a-f]{32}")
_TURN_COUNT_RANGES = {
    "single_turn": (1, 1),
    "short": (2, 3),
    "medium": (4, 7),
    "long": (8, 16),
}


class FileMetadata(TypedDict):
    sha256: str
    size_bytes: int


class ComposerDefaults(TypedDict):
    session_fragments_median: float
    session_fragments_sigma: float
    session_fragments_max: int
    archetype_mix: Mapping[Archetype, float]
    fragment_gap_median_seconds: float
    fragment_gap_sigma: float
    fragment_gap_max_seconds: float


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
    composer_defaults: ComposerDefaults


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
    topic: str
    scenario_template: str
    persona: str
    register: str
    quality_tier: QualityTier
    failure_mode: str
    length_band: LengthBand
    lane: GenerationLane
    models_used: tuple[ModelUsed, ...]
    turn_count: int
    trace_ids: tuple[str, ...]
    content_sha256: str
    quality_results: Mapping[str, Any]


class SchemaValidationError(ValueError):
    def __init__(self, field: str, message: str) -> None:
        self.field = field
        super().__init__(message)


def validate_manifest_v2(value: Mapping[str, Any]) -> ScenarioManifestV2:
    _require_literal(value, "schema_version", 2)
    _require_string(value, "scenario_name")
    generated_at = _require_string(value, "generated_at")
    try:
        parsed_timestamp = datetime.fromisoformat(generated_at.replace("Z", "+00:00"))
    except ValueError as error:
        raise SchemaValidationError("generated_at", "must be an ISO-8601 timestamp") from error
    if parsed_timestamp.tzinfo is None:
        raise SchemaValidationError("generated_at", "must include a UTC offset")
    _require_string(value, "generation_revision")
    _require_sha256(value, "matrix_sha256")
    _require_int(value, "matrix_seed")
    for field in ("fragment_count", "trace_count", "span_count"):
        _require_int(value, field, minimum=0)

    span_kinds = _require_sequence(value, "span_kinds")
    if not span_kinds or any(not isinstance(item, str) or not item for item in span_kinds):
        raise SchemaValidationError("span_kinds", "must contain non-empty strings")
    if len(set(span_kinds)) != len(span_kinds):
        raise SchemaValidationError("span_kinds", "must not contain duplicates")

    versions = _require_mapping(value, "instrumenter_package_versions")
    if any(
        not isinstance(key, str) or not key or not isinstance(item, str) or not item
        for key, item in versions.items()
    ):
        raise SchemaValidationError(
            "instrumenter_package_versions", "must map non-empty package names to versions"
        )

    files = _require_mapping(value, "files")
    for filename in ("fragments.jsonl", "traces.jsonl"):
        metadata = files.get(filename)
        field = f"files.{filename}"
        if not isinstance(metadata, Mapping):
            raise SchemaValidationError(field, "must be an object")
        _require_sha256(metadata, "sha256", prefix=field)
        _require_int(metadata, "size_bytes", minimum=0, prefix=field)

    _require_mapping(value, "quality_gate_summary")
    _validate_composer_defaults(_require_mapping(value, "composer_defaults"))
    return cast(ScenarioManifestV2, value)


def validate_fragment_v2(value: Mapping[str, Any]) -> Fragment:
    fragment_id = _require_sha256(value, "fragment_id")
    archetype = _require_choice(value, "archetype", ARCHETYPES)
    domain = _require_string(value, "domain")
    topic = _require_string(value, "topic")
    scenario_template = _require_string(value, "scenario_template")
    persona = _require_string(value, "persona")
    register = _require_string(value, "register")
    quality_tier = _require_choice(value, "quality_tier", QUALITY_TIERS)
    failure_mode = _require_string(value, "failure_mode")
    length_band = _require_choice(value, "length_band", LENGTH_BANDS)
    lane = _require_choice(value, "lane", GENERATION_LANES)
    turn_count = _require_int(value, "turn_count", minimum=1)

    minimum, maximum = _TURN_COUNT_RANGES[length_band]
    if not minimum <= turn_count <= maximum:
        raise SchemaValidationError(
            "turn_count", f"must be between {minimum} and {maximum} for length_band={length_band!r}"
        )

    raw_models = _require_sequence(value, "models_used")
    if not raw_models:
        raise SchemaValidationError("models_used", "must not be empty")
    models = []
    for index, raw_model in enumerate(raw_models):
        field = f"models_used[{index}]"
        if not isinstance(raw_model, Mapping):
            raise SchemaValidationError(field, "must be an object")
        models.append(
            ModelUsed(
                role=_require_string(raw_model, "role", prefix=field),
                provider=_require_string(raw_model, "provider", prefix=field),
                model=_require_string(raw_model, "model", prefix=field),
            )
        )

    raw_trace_ids = _require_sequence(value, "trace_ids")
    if not raw_trace_ids:
        raise SchemaValidationError("trace_ids", "must not be empty")
    trace_ids = []
    for index, trace_id in enumerate(raw_trace_ids):
        if not isinstance(trace_id, str) or _TRACE_ID_PATTERN.fullmatch(trace_id) is None:
            raise SchemaValidationError(
                f"trace_ids[{index}]", "must be a 32-character lowercase hexadecimal trace ID"
            )
        trace_ids.append(trace_id)
    if len(set(trace_ids)) != len(trace_ids):
        raise SchemaValidationError("trace_ids", "must not contain duplicates")

    content_sha256 = _require_sha256(value, "content_sha256")
    quality_results = _require_mapping(value, "quality_results")
    return Fragment(
        fragment_id=fragment_id,
        archetype=cast(Archetype, archetype),
        domain=domain,
        topic=topic,
        scenario_template=scenario_template,
        persona=persona,
        register=register,
        quality_tier=cast(QualityTier, quality_tier),
        failure_mode=failure_mode,
        length_band=cast(LengthBand, length_band),
        lane=cast(GenerationLane, lane),
        models_used=tuple(models),
        turn_count=turn_count,
        trace_ids=tuple(trace_ids),
        content_sha256=content_sha256,
        quality_results=quality_results,
    )


def _validate_composer_defaults(value: Mapping[str, Any]) -> None:
    _require_number(value, "session_fragments_median", minimum=0, exclusive_minimum=True)
    _require_number(value, "session_fragments_sigma", minimum=0)
    _require_int(value, "session_fragments_max", minimum=1)
    archetype_mix = _require_mapping(value, "archetype_mix")
    for archetype, weight in archetype_mix.items():
        if archetype not in ARCHETYPES:
            raise SchemaValidationError(
                f"composer_defaults.archetype_mix.{archetype}", "is not a supported archetype"
            )
        if not _is_number(weight) or weight <= 0:
            raise SchemaValidationError(
                f"composer_defaults.archetype_mix.{archetype}", "must be greater than zero"
            )
    _require_number(value, "fragment_gap_median_seconds", minimum=0)
    _require_number(value, "fragment_gap_sigma", minimum=0)
    _require_number(value, "fragment_gap_max_seconds", minimum=0)


def _require_mapping(value: Mapping[str, Any], field: str) -> Mapping[str, Any]:
    item = value.get(field)
    if not isinstance(item, Mapping):
        raise SchemaValidationError(field, "must be an object")
    return item


def _require_sequence(value: Mapping[str, Any], field: str) -> Sequence[Any]:
    item = value.get(field)
    if not isinstance(item, list):
        raise SchemaValidationError(field, "must be an array")
    return item


def _require_string(value: Mapping[str, Any], field: str, *, prefix: str = "") -> str:
    item = value.get(field)
    if not isinstance(item, str) or not item:
        raise SchemaValidationError(_field(prefix, field), "must be a non-empty string")
    return item


def _require_sha256(value: Mapping[str, Any], field: str, *, prefix: str = "") -> str:
    item = value.get(field)
    if not isinstance(item, str) or _SHA256_PATTERN.fullmatch(item) is None:
        raise SchemaValidationError(
            _field(prefix, field), "must be a 64-character lowercase hexadecimal SHA-256"
        )
    return item


def _require_int(
    value: Mapping[str, Any], field: str, *, minimum: int | None = None, prefix: str = ""
) -> int:
    item = value.get(field)
    if type(item) is not int or minimum is not None and item < minimum:
        qualifier = f" greater than or equal to {minimum}" if minimum is not None else ""
        raise SchemaValidationError(_field(prefix, field), f"must be an integer{qualifier}")
    return item


def _require_number(
    value: Mapping[str, Any],
    field: str,
    *,
    minimum: float,
    exclusive_minimum: bool = False,
) -> float:
    item = value.get(field)
    number = cast(int | float, item)
    invalid = not _is_number(item)
    if not invalid:
        invalid = number <= minimum if exclusive_minimum else number < minimum
    if invalid:
        comparison = "greater than" if exclusive_minimum else "greater than or equal to"
        raise SchemaValidationError(
            f"composer_defaults.{field}", f"must be a number {comparison} {minimum}"
        )
    return float(number)


def _require_literal(value: Mapping[str, Any], field: str, expected: Any) -> None:
    if value.get(field) != expected or type(value.get(field)) is not type(expected):
        raise SchemaValidationError(field, f"must be {expected!r}")


def _require_choice(value: Mapping[str, Any], field: str, choices: frozenset[str]) -> str:
    item = value.get(field)
    if not isinstance(item, str) or item not in choices:
        raise SchemaValidationError(field, f"must be one of {sorted(choices)!r}")
    return item


def _is_number(value: Any) -> bool:
    return type(value) in (int, float) and isfinite(value)


def _field(prefix: str, field: str) -> str:
    return f"{prefix}.{field}" if prefix else field

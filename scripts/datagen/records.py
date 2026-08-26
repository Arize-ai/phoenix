from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Literal, Mapping, Sequence, TypedDict

from phoenix.datagen.schema import Archetype

QualityTier = Literal["high", "standard", "deliberately_bad"]
LengthBand = Literal["single_turn", "short", "medium", "long"]
GenerationLane = Literal["self_play", "scripted"]

QUALITY_TIERS = frozenset({"high", "standard", "deliberately_bad"})
LENGTH_BANDS = frozenset({"single_turn", "short", "medium", "long"})
GENERATION_LANES = frozenset({"self_play", "scripted"})


class FileMetadata(TypedDict):
    sha256: str
    size_bytes: int


class CorpusManifestV2(TypedDict):
    schema_version: Literal[2]
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

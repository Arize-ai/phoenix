"""Application-profile loading and canonicalization for offline datagen."""

from __future__ import annotations

import json
from dataclasses import dataclass
from hashlib import sha256
from math import isfinite
from pathlib import Path, PurePosixPath
from typing import Any, Mapping, Sequence, cast

from phoenix.datagen.schema import ARCHETYPES, QUALITY_TIERS

DOMAINS = frozenset({"coding_agent", "customer_support", "deep_research", "data_analyst"})
SEED_CATEGORIES = frozenset({"corpus", "tool_data", "user", "dynamics", "pressure"})
DEFAULT_SAMPLING: Mapping[str, Any] = {
    "targeted_cell_fraction": 0.10,
    "intensity_distribution": {"kind": "beta", "alpha": 2.0, "beta": 8.0},
}


class ProfileValidationError(ValueError):
    """Raised when an application-profile set is unsafe or inconsistent."""


@dataclass(frozen=True)
class WeightedValue:
    value: str
    weight: float


@dataclass(frozen=True)
class PersonaProfile:
    persona_id: str
    instructions: str
    weight: float


@dataclass(frozen=True)
class ScenarioProfile:
    scenario_id: str
    topic: str
    template: str
    weight: float
    target_seed_ids: tuple[str, ...]


@dataclass(frozen=True)
class TurnCountProfile:
    value: int
    weight: float


@dataclass(frozen=True)
class AdversarialSeed:
    seed_id: str
    category: str
    description: str


@dataclass(frozen=True)
class CorpusDocument:
    document_id: str
    path: str


@dataclass(frozen=True)
class ApplicationProfileV1:
    profile_id: str
    domain: str
    archetype: str
    tool_surface: tuple[str, ...]
    corpus_documents: tuple[CorpusDocument, ...]
    personas: tuple[PersonaProfile, ...]
    registers: tuple[WeightedValue, ...]
    scenarios: tuple[ScenarioProfile, ...]
    quality_tiers: tuple[WeightedValue, ...]
    turn_counts: tuple[TurnCountProfile, ...]
    adversarial_seeds: tuple[AdversarialSeed, ...]
    source_path: str


@dataclass(frozen=True)
class ProfileSetV1:
    profiles: tuple[ApplicationProfileV1, ...]
    sampling: Mapping[str, Any]
    canonical_bytes: bytes
    profile_set_sha256: str


def load_profile_set(path: Path) -> ProfileSetV1:
    manifest = _read_object(path)
    _literal(manifest, "schema_version", 1)
    raw_paths = _array(manifest, "profiles")
    if not raw_paths:
        raise ProfileValidationError("profiles must not be empty")
    profile_paths = [_safe_relative(item, "profiles") for item in raw_paths]
    if len(set(profile_paths)) != len(profile_paths):
        raise ProfileValidationError("profiles must not contain duplicates")

    profiles = tuple(_load_profile(path.parent, relative) for relative in profile_paths)
    profile_ids = [profile.profile_id for profile in profiles]
    if len(set(profile_ids)) != len(profile_ids):
        raise ProfileValidationError("profile_id values must be unique in a profile set")
    profiles = tuple(sorted(profiles, key=lambda profile: profile.profile_id))
    sampling = _sampling(manifest.get("sampling", {}))
    snapshot = {
        "schema_version": 1,
        "profiles": [_profile_dict(profile) for profile in profiles],
        "sampling": sampling,
    }
    canonical = json.dumps(snapshot, sort_keys=True, separators=(",", ":")).encode()
    return ProfileSetV1(profiles, sampling, canonical, sha256(canonical).hexdigest())


def load_profile_snapshot(content: bytes) -> ProfileSetV1:
    try:
        value = json.loads(content)
    except json.JSONDecodeError as error:
        raise ProfileValidationError(f"invalid profile snapshot: {error}") from error
    if not isinstance(value, Mapping):
        raise ProfileValidationError("profile snapshot must be an object")
    canonical = json.dumps(value, sort_keys=True, separators=(",", ":")).encode()
    if canonical != content:
        raise ProfileValidationError("profile snapshot is not canonical JSON")
    _literal(value, "schema_version", 1)
    sampling = _sampling(value.get("sampling", {}))
    raw_profiles = _array(value, "profiles")
    profiles = tuple(_profile_from_snapshot(item) for item in raw_profiles)
    if tuple(sorted(profile.profile_id for profile in profiles)) != tuple(
        profile.profile_id for profile in profiles
    ):
        raise ProfileValidationError("snapshot profiles must be sorted by profile_id")
    return ProfileSetV1(profiles, sampling, canonical, sha256(canonical).hexdigest())


def _load_profile(root: Path, relative: str) -> ApplicationProfileV1:
    path = root.joinpath(*PurePosixPath(relative).parts)
    value = _read_object(path)
    profile = _parse_profile(value, source_path=relative)
    expected = PurePosixPath(relative)
    if expected.name != "profile.json" or len(expected.parts) < 3:
        raise ProfileValidationError(f"profile path {relative!r} must end in <domain>/<archetype>/profile.json")
    if expected.parts[-3:-1] != (profile.domain, profile.archetype):
        raise ProfileValidationError(
            f"profile path {relative!r} does not match identity {profile.profile_id!r}"
        )
    profile_dir = path.parent.resolve()
    for document in profile.corpus_documents:
        resolved = profile_dir.joinpath(*PurePosixPath(document.path).parts).resolve()
        if not resolved.is_relative_to(profile_dir):
            raise ProfileValidationError(f"corpus document {document.path!r} escapes its profile directory")
    return profile


def _profile_from_snapshot(value: Any) -> ApplicationProfileV1:
    if not isinstance(value, Mapping):
        raise ProfileValidationError("snapshot profiles must be objects")
    source_path = _string(value, "source_path")
    return _parse_profile(value, source_path=source_path)


def _parse_profile(value: Mapping[str, Any], *, source_path: str) -> ApplicationProfileV1:
    _literal(value, "schema_version", 1)
    domain = _choice(value, "domain", DOMAINS)
    archetype = _choice(value, "archetype", ARCHETYPES)
    profile_id = _string(value, "profile_id")
    if profile_id != f"{domain}/{archetype}":
        raise ProfileValidationError("profile_id must equal <domain>/<archetype>")
    tools = tuple(_nonempty_strings(_array(value, "tool_surface"), "tool_surface"))
    documents = tuple(
        CorpusDocument(
            _string_object(item, "document_id", field),
            _safe_relative(_object(item, field).get("path"), f"{field}.path"),
        )
        for index, item in enumerate(_array(value, "corpus_documents"))
        for field in (f"corpus_documents[{index}]",)
    )
    personas = tuple(
        PersonaProfile(
            _string_object(item, "persona_id", field),
            _string_object(item, "instructions", field),
            _weight(_object(item, field).get("weight"), f"{field}.weight"),
        )
        for index, item in enumerate(_array(value, "personas"))
        for field in (f"personas[{index}]",)
    )
    registers = _weighted_values(value, "registers")
    quality_tiers = _weighted_values(value, "quality_tiers", choices=QUALITY_TIERS)
    turns = tuple(
        TurnCountProfile(
            _turn_count(_object(item, field).get("value"), f"{field}.value"),
            _weight(_object(item, field).get("weight"), f"{field}.weight"),
        )
        for index, item in enumerate(_array(value, "turn_counts"))
        for field in (f"turn_counts[{index}]",)
    )
    seeds = tuple(
        AdversarialSeed(
            _string_object(item, "seed_id", field),
            _choice_object(item, "category", SEED_CATEGORIES, field),
            _string_object(item, "description", field),
        )
        for index, item in enumerate(_array(value, "adversarial_seeds"))
        for field in (f"adversarial_seeds[{index}]",)
    )
    seed_ids = {seed.seed_id for seed in seeds}
    _unique([seed.seed_id for seed in seeds], "adversarial_seeds.seed_id")
    _unique([persona.persona_id for persona in personas], "personas.persona_id")
    _unique([document.document_id for document in documents], "corpus_documents.document_id")
    scenarios = []
    for index, item in enumerate(_array(value, "scenarios")):
        field = f"scenarios[{index}]"
        raw = _object(item, field)
        target_ids = tuple(_nonempty_strings(_array(raw, "target_seed_ids"), f"{field}.target_seed_ids"))
        unknown = set(target_ids) - seed_ids
        if unknown:
            raise ProfileValidationError(
                f"{field}.target_seed_ids references unknown profile seeds {sorted(unknown)!r}"
            )
        scenarios.append(
            ScenarioProfile(
                _string(raw, "scenario_id", prefix=field),
                _string(raw, "topic", prefix=field),
                _string(raw, "template", prefix=field),
                _weight(raw.get("weight"), f"{field}.weight"),
                target_ids,
            )
        )
    _unique([scenario.scenario_id for scenario in scenarios], "scenarios.scenario_id")
    for name, items in (
        ("personas", personas),
        ("registers", registers),
        ("scenarios", scenarios),
        ("quality_tiers", quality_tiers),
        ("turn_counts", turns),
    ):
        if not items:
            raise ProfileValidationError(f"{name} must not be empty")
    return ApplicationProfileV1(
        profile_id,
        domain,
        archetype,
        tools,
        documents,
        personas,
        registers,
        tuple(scenarios),
        quality_tiers,
        turns,
        seeds,
        source_path,
    )


def _sampling(value: Any) -> Mapping[str, Any]:
    if not isinstance(value, Mapping):
        raise ProfileValidationError("sampling must be an object")
    fraction = value.get("targeted_cell_fraction", DEFAULT_SAMPLING["targeted_cell_fraction"])
    if not _number(fraction) or not 0 <= cast(float, fraction) <= 1:
        raise ProfileValidationError("sampling.targeted_cell_fraction must be between 0 and 1")
    raw_distribution = value.get("intensity_distribution", DEFAULT_SAMPLING["intensity_distribution"])
    if not isinstance(raw_distribution, Mapping) or raw_distribution.get("kind") != "beta":
        raise ProfileValidationError("sampling.intensity_distribution.kind must be 'beta'")
    alpha = raw_distribution.get("alpha", 2.0)
    beta = raw_distribution.get("beta", 8.0)
    if not _number(alpha) or cast(float, alpha) <= 0 or not _number(beta) or cast(float, beta) <= 0:
        raise ProfileValidationError("sampling beta parameters must be finite and greater than zero")
    return {
        "targeted_cell_fraction": float(cast(float, fraction)),
        "intensity_distribution": {"kind": "beta", "alpha": float(cast(float, alpha)), "beta": float(cast(float, beta))},
    }


def _profile_dict(profile: ApplicationProfileV1) -> dict[str, Any]:
    return {
        "schema_version": 1,
        "source_path": profile.source_path,
        "profile_id": profile.profile_id,
        "domain": profile.domain,
        "archetype": profile.archetype,
        "tool_surface": list(profile.tool_surface),
        "corpus_documents": [document.__dict__ for document in profile.corpus_documents],
        "personas": [persona.__dict__ for persona in profile.personas],
        "registers": [item.__dict__ for item in profile.registers],
        "scenarios": [
            {**scenario.__dict__, "target_seed_ids": list(scenario.target_seed_ids)}
            for scenario in profile.scenarios
        ],
        "quality_tiers": [item.__dict__ for item in profile.quality_tiers],
        "turn_counts": [item.__dict__ for item in profile.turn_counts],
        "adversarial_seeds": [seed.__dict__ for seed in profile.adversarial_seeds],
    }


def _weighted_values(value: Mapping[str, Any], field: str, *, choices: frozenset[str] | None = None) -> tuple[WeightedValue, ...]:
    result = []
    for index, item in enumerate(_array(value, field)):
        prefix = f"{field}[{index}]"
        raw = _object(item, prefix)
        selected = _string(raw, "value", prefix=prefix)
        if choices is not None and selected not in choices:
            raise ProfileValidationError(f"{prefix}.value must be one of {sorted(choices)!r}")
        result.append(WeightedValue(selected, _weight(raw.get("weight"), f"{prefix}.weight")))
    return tuple(result)


def _read_object(path: Path) -> Mapping[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise ProfileValidationError(f"unable to read {path}: {error}") from error
    if not isinstance(value, Mapping):
        raise ProfileValidationError(f"{path} must contain a JSON object")
    return value


def _safe_relative(value: Any, field: str) -> str:
    if not isinstance(value, str) or not value:
        raise ProfileValidationError(f"{field} must be a non-empty POSIX-relative path")
    path = PurePosixPath(value)
    if path.is_absolute() or ".." in path.parts or "." in path.parts or "\\" in value:
        raise ProfileValidationError(f"{field} must not be absolute or traverse parent directories")
    return path.as_posix()


def _object(value: Any, field: str) -> Mapping[str, Any]:
    if not isinstance(value, Mapping):
        raise ProfileValidationError(f"{field} must be an object")
    return value


def _array(value: Mapping[str, Any], field: str) -> Sequence[Any]:
    item = value.get(field)
    if not isinstance(item, list):
        raise ProfileValidationError(f"{field} must be an array")
    return item


def _string(value: Mapping[str, Any], field: str, *, prefix: str = "") -> str:
    item = value.get(field)
    if not isinstance(item, str) or not item:
        name = f"{prefix}.{field}" if prefix else field
        raise ProfileValidationError(f"{name} must be a non-empty string")
    return item


def _string_object(value: Any, field: str, prefix: str) -> str:
    return _string(_object(value, prefix), field, prefix=prefix)


def _choice(value: Mapping[str, Any], field: str, choices: frozenset[str]) -> str:
    item = _string(value, field)
    if item not in choices:
        raise ProfileValidationError(f"{field} must be one of {sorted(choices)!r}")
    return item


def _choice_object(value: Any, field: str, choices: frozenset[str], prefix: str) -> str:
    item = _string_object(value, field, prefix)
    if item not in choices:
        raise ProfileValidationError(f"{prefix}.{field} must be one of {sorted(choices)!r}")
    return item


def _literal(value: Mapping[str, Any], field: str, expected: Any) -> None:
    if value.get(field) != expected or type(value.get(field)) is not type(expected):
        raise ProfileValidationError(f"{field} must be {expected!r}")


def _weight(value: Any, field: str) -> float:
    if not _number(value) or cast(float, value) <= 0:
        raise ProfileValidationError(f"{field} must be finite and greater than zero")
    return float(cast(float, value))


def _turn_count(value: Any, field: str) -> int:
    if type(value) is not int or not 1 <= cast(int, value) <= 16:
        raise ProfileValidationError(f"{field} must be an integer between 1 and 16")
    return cast(int, value)


def _number(value: Any) -> bool:
    return type(value) in (int, float) and isfinite(cast(float, value))


def _nonempty_strings(values: Sequence[Any], field: str) -> list[str]:
    if any(not isinstance(item, str) or not item for item in values):
        raise ProfileValidationError(f"{field} must contain non-empty strings")
    return cast(list[str], list(values))


def _unique(values: Sequence[str], field: str) -> None:
    if len(set(values)) != len(values):
        raise ProfileValidationError(f"{field} values must be unique")

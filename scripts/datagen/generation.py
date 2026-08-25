"""Resumable attempt state for offline datagen passes."""

from __future__ import annotations

import json
import random
from dataclasses import asdict, dataclass, field, replace
from datetime import datetime, timezone
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation
from hashlib import sha256
from pathlib import Path
from typing import TYPE_CHECKING, Any, Literal, Mapping, Sequence, cast

if TYPE_CHECKING or __package__:
    from scripts.datagen.profile import (
        ApplicationProfileV1,
        ProfileSetV1,
        load_profile_snapshot,
    )
    from scripts.datagen.serialization import (
        append_json,
        canonical_bytes,
        read_jsonl,
        write_immutable_bytes,
        write_immutable_json,
    )
else:
    from profile import (  # type: ignore[import-not-found,no-redef]
        ApplicationProfileV1,
        ProfileSetV1,
        load_profile_snapshot,
    )

    from serialization import (  # type: ignore[import-not-found,no-redef]
        append_json,
        canonical_bytes,
        read_jsonl,
        write_immutable_bytes,
        write_immutable_json,
    )

Lane = Literal["self_play", "scripted"]
FailureMode = Literal[
    "none",
    "provider_429",
    "provider_timeout",
    "malformed_response",
    "tool_delay",
    "tool_exception",
]

DEFAULT_LANE_TARGETS: Mapping[Lane, int] = {"self_play": 3_000, "scripted": 2_000}
LANES: tuple[Lane, Lane] = ("self_play", "scripted")
ATTEMPT_MULTIPLIER = Decimal("1.25")
FRONTIER_FRACTION = Decimal("0.05")
PROVIDER_FAILURE_MODES = frozenset({"provider_429", "provider_timeout", "malformed_response"})
TOOL_FAILURE_MODES = frozenset({"tool_delay", "tool_exception"})
FAILURE_MODES = PROVIDER_FAILURE_MODES | TOOL_FAILURE_MODES
RUN_SCHEMA_VERSION = 2
MATRIX_SCHEMA_VERSION = 2

_JOURNALS = (
    "attempts.jsonl",
    "accepted.jsonl",
    "rejects.jsonl",
    "judging-inputs.jsonl",
    "judgments.jsonl",
)
_TERMINAL_ATTEMPT_EVENTS = frozenset({"completed", "failed"})


class GenerationError(ValueError):
    """Raised when persisted generation state would become inconsistent."""


class ConfigurationMismatch(GenerationError):
    """Raised when a resume request differs from the immutable run inputs."""


class AlreadyAccepted(GenerationError):
    """Raised when work is requested for an immutable accepted cell."""


class AttemptCapExceeded(GenerationError):
    def __init__(self, lane: Lane, attempts: int, cap: int) -> None:
        self.lane = lane
        self.attempts = attempts
        self.cap = cap
        super().__init__(f"{lane} attempt cap exhausted: {attempts}/{cap}")


@dataclass(frozen=True)
class ProfileDraw:
    profile_id: str
    domain: str
    archetype: str
    scenario_id: str
    topic: str
    scenario_template: str
    persona_id: str
    persona_instructions: str
    register: str
    quality_tier: str
    turn_count: int
    target_mode: Literal["ambient", "targeted"]
    targeted_seed_id: str | None
    seed_intensities: Mapping[str, float]
    failure_mode: FailureMode = "none"
    failure_turn: int | None = None

    def __post_init__(self) -> None:
        if self.failure_mode != "none" and self.failure_mode not in FAILURE_MODES:
            raise GenerationError(f"unknown profile fault mode {self.failure_mode!r}")
        if self.failure_mode in PROVIDER_FAILURE_MODES:
            if (
                isinstance(self.failure_turn, bool)
                or not isinstance(self.failure_turn, int)
                or not 0 <= self.failure_turn < self.turn_count
            ):
                raise GenerationError("provider fault turn must identify an existing turn")
        elif self.failure_turn is not None:
            raise GenerationError("none and tool fault modes cannot name a failure turn")

    def to_dict(self) -> dict[str, Any]:
        return {
            **asdict(self),
            "seed_intensities": dict(sorted(self.seed_intensities.items())),
        }


@dataclass(frozen=True)
class MatrixCell:
    cell_id: str
    lane: Lane
    ordinal: int
    profile: ProfileDraw
    assistant_model: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "cell_id": self.cell_id,
            "lane": self.lane,
            "ordinal": self.ordinal,
            "profile": self.profile.to_dict(),
            "assistant_model": self.assistant_model,
        }


@dataclass(frozen=True)
class RunConfig:
    run_id: str
    matrix_seed: int
    matrix_sha256: str
    luna_model: str
    frontier_model: str
    profile_set_sha256: str
    luna_provider: str = "openai_api"
    frontier_provider: str = "openai_api"
    run_schema_version: int = RUN_SCHEMA_VERSION
    matrix_schema_version: int = MATRIX_SCHEMA_VERSION
    self_play_target: int = 3_000
    scripted_target: int = 2_000
    fault_fraction: str = "0"
    fault_mode_weights: Mapping[str, str] = field(default_factory=dict)
    base_scenario_name: str | None = None
    base_archive_sha256: str | None = None

    def __post_init__(self) -> None:
        if not self.run_id or ":" in self.run_id:
            raise GenerationError("run_id must be non-empty and must not contain ':'")
        if not self.luna_model or not self.frontier_model:
            raise GenerationError("luna_model and frontier_model must be configured explicitly")
        for provider in (self.luna_provider, self.frontier_provider):
            if provider not in {"openai_api", "codex_exec"}:
                raise GenerationError(f"unsupported model provider {provider!r}")
        for field_name, digest in (
            ("matrix_sha256", self.matrix_sha256),
            ("profile_set_sha256", self.profile_set_sha256),
        ):
            if len(digest) != 64 or any(
                character not in "0123456789abcdef" for character in digest
            ):
                raise GenerationError(f"{field_name} must be a SHA-256 hex digest")
        if self.self_play_target < 1 or self.scripted_target < 1:
            raise GenerationError("lane targets must be positive")
        if (
            self.run_schema_version != RUN_SCHEMA_VERSION
            or self.matrix_schema_version != MATRIX_SCHEMA_VERSION
        ):
            raise GenerationError(
                "schema-v1 flat runs cannot resume; create a profile set and initialize a new run"
            )
        fraction = _decimal(self.fault_fraction, "fault_fraction")
        if not Decimal() <= fraction <= Decimal(1):
            raise GenerationError("fault_fraction must be between 0 and 1")
        weights = _normalize_fault_mode_weights(self.fault_mode_weights)
        if bool(weights) != bool(fraction):
            raise GenerationError("fault_fraction and fault_mode_weights must be set together")
        object.__setattr__(self, "fault_fraction", _decimal_string(fraction))
        object.__setattr__(self, "fault_mode_weights", weights)
        if (self.base_scenario_name is None) != (self.base_archive_sha256 is None):
            raise GenerationError("base_scenario_name and base_archive_sha256 must be set together")
        if self.base_scenario_name is not None:
            if not self.base_scenario_name.strip():
                raise GenerationError("base_scenario_name must be non-empty")
            assert self.base_archive_sha256 is not None
            _validate_sha256("base_archive_sha256", self.base_archive_sha256)

    @property
    def lane_targets(self) -> Mapping[Lane, int]:
        return {"self_play": self.self_play_target, "scripted": self.scripted_target}

    @property
    def lane_attempt_caps(self) -> Mapping[Lane, int]:
        return {
            lane: int(Decimal(target) * ATTEMPT_MULTIPLIER)
            for lane, target in self.lane_targets.items()
        }

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    def provider_for_model(self, model: str) -> str:
        matches = []
        if model == self.luna_model:
            matches.append(self.luna_provider)
        if model == self.frontier_model:
            matches.append(self.frontier_provider)
        if not matches:
            raise ConfigurationMismatch(f"model {model!r} is not configured for this run")
        if len(set(matches)) != 1:
            raise ConfigurationMismatch(
                f"model {model!r} has conflicting immutable provider bindings"
            )
        return matches[0]


@dataclass(frozen=True)
class Attempt:
    attempt_id: str
    cell_id: str
    lane: Lane
    purpose: str
    attempt_number: int
    provider: str
    model: str


def expand_seed_matrix(
    profile_set: ProfileSetV1,
    *,
    seed: int,
    luna_model: str,
    frontier_model: str,
    lane_targets: Mapping[Lane, int] = DEFAULT_LANE_TARGETS,
    fault_fraction: Decimal = Decimal(),
    fault_mode_weights: Mapping[str, Decimal | str | float] | None = None,
) -> tuple[MatrixCell, ...]:
    """Draw stable, profile-scoped matrix cells."""
    profiles = tuple(sorted(profile_set.profiles, key=lambda profile: profile.profile_id))
    if not profiles:
        raise GenerationError("profile set must not be empty")
    cells = []
    for lane in LANES:
        target = lane_targets[lane]
        if target < 1:
            raise GenerationError(f"{lane} target must be positive")
        for ordinal in range(target):
            profile = profiles[ordinal % len(profiles)]
            draw = _profile_draw(profile_set, profile, seed=seed, lane=lane, ordinal=ordinal)
            identity = {
                "schema_version": MATRIX_SCHEMA_VERSION,
                "matrix_seed": seed,
                "profile_set_sha256": profile_set.profile_set_sha256,
                "lane": lane,
                "ordinal": ordinal,
                "profile": draw.to_dict(),
            }
            cell_id = sha256(canonical_bytes(identity)).hexdigest()
            use_frontier = lane == "self_play" and ordinal % int(1 / FRONTIER_FRACTION) == 0
            cells.append(
                MatrixCell(
                    cell_id=cell_id,
                    lane=lane,
                    ordinal=ordinal,
                    profile=draw,
                    assistant_model=frontier_model if use_frontier else luna_model,
                )
            )
    return _allocate_faults(
        tuple(cells),
        profile_set,
        seed=seed,
        fault_fraction=fault_fraction,
        fault_mode_weights=fault_mode_weights,
    )


def _allocate_faults(
    cells: tuple[MatrixCell, ...],
    profile_set: ProfileSetV1,
    *,
    seed: int,
    fault_fraction: Decimal,
    fault_mode_weights: Mapping[str, Decimal | str | float] | None,
) -> tuple[MatrixCell, ...]:
    fraction = _decimal(fault_fraction, "fault_fraction")
    if not Decimal() <= fraction <= Decimal(1):
        raise GenerationError("fault_fraction must be between 0 and 1")
    weights = _normalize_fault_mode_weights(fault_mode_weights or {})
    if not weights:
        if fraction:
            raise GenerationError("fault_fraction requires at least one fault mode")
        return cells
    if not fraction:
        raise GenerationError("fault modes require a positive fault_fraction")

    fault_count = int((Decimal(len(cells)) * fraction).to_integral_value(rounding=ROUND_HALF_UP))
    if fault_count < len(weights):
        raise GenerationError(
            f"fault allocation has {fault_count} cells for {len(weights)} requested modes"
        )
    profiles = {profile.profile_id: profile for profile in profile_set.profiles}

    def eligible(cell: MatrixCell, mode: str) -> bool:
        if mode in PROVIDER_FAILURE_MODES:
            return cell.lane == "scripted"
        profile = profiles[cell.profile.profile_id]
        return cell.lane == "self_play" and bool(profile.tool_surface)

    eligible_cells = {
        mode: tuple(cell for cell in cells if eligible(cell, mode)) for mode in weights
    }
    unavailable = sorted(mode for mode, candidates in eligible_cells.items() if not candidates)
    if unavailable:
        raise GenerationError(f"fault modes have no eligible cells: {unavailable!r}")
    union = {cell.cell_id for candidates in eligible_cells.values() for cell in candidates}
    if fault_count > len(union):
        raise GenerationError(
            f"fault allocation requests {fault_count} cells but only {len(union)} are eligible"
        )

    assignments: dict[str, str] = {}
    for mode in sorted(weights):
        candidates = sorted(
            eligible_cells[mode],
            key=lambda cell: _fault_rank(seed, f"coverage:{mode}", cell),
        )
        selected = next((cell for cell in candidates if cell.cell_id not in assignments), None)
        if selected is None:
            raise GenerationError("requested fault modes cannot cover distinct eligible cells")
        assignments[selected.cell_id] = mode

    for ordinal in range(fault_count - len(assignments)):
        available_weights = {
            mode: weight
            for mode, weight in weights.items()
            if any(cell.cell_id not in assignments for cell in eligible_cells[mode])
        }
        mode = _weighted_fault_mode(seed, ordinal, available_weights)
        candidates = sorted(
            (cell for cell in eligible_cells[mode] if cell.cell_id not in assignments),
            key=lambda cell: _fault_rank(seed, f"weighted:{ordinal}:{mode}", cell),
        )
        assignments[candidates[0].cell_id] = mode

    allocated = []
    for cell in cells:
        mode = assignments.get(cell.cell_id, "none")
        failure_turn = _fault_turn(seed, cell) if mode in PROVIDER_FAILURE_MODES else None
        draw = replace(
            cell.profile, failure_mode=cast(FailureMode, mode), failure_turn=failure_turn
        )
        identity = {
            "schema_version": MATRIX_SCHEMA_VERSION,
            "matrix_seed": seed,
            "profile_set_sha256": profile_set.profile_set_sha256,
            "lane": cell.lane,
            "ordinal": cell.ordinal,
            "profile": draw.to_dict(),
        }
        allocated.append(
            replace(
                cell,
                cell_id=sha256(canonical_bytes(identity)).hexdigest(),
                profile=draw,
            )
        )
    return tuple(allocated)


def _fault_rank(seed: int, purpose: str, cell: MatrixCell) -> bytes:
    value = f"{MATRIX_SCHEMA_VERSION}:{seed}:fault:{purpose}:{cell.lane}:{cell.ordinal}"
    return sha256(value.encode()).digest()


def _weighted_fault_mode(seed: int, ordinal: int, weights: Mapping[str, str]) -> str:
    identity = f"{MATRIX_SCHEMA_VERSION}:{seed}:fault:mode:{ordinal}"
    generator = random.Random(int.from_bytes(sha256(identity.encode()).digest(), "big"))
    total = sum((Decimal(weight) for weight in weights.values()), Decimal())
    threshold = Decimal(str(generator.random())) * total
    cumulative = Decimal()
    for mode, weight in sorted(weights.items()):
        cumulative += Decimal(weight)
        if threshold < cumulative:
            return mode
    return sorted(weights)[-1]


def _fault_turn(seed: int, cell: MatrixCell) -> int:
    generator = random.Random(int.from_bytes(_fault_rank(seed, "turn", cell), "big"))
    return generator.randrange(cell.profile.turn_count)


def _normalize_fault_mode_weights(
    values: Mapping[str, Decimal | str | float],
) -> dict[str, str]:
    unknown = sorted(set(values) - FAILURE_MODES)
    if unknown:
        raise GenerationError(f"unknown fault modes: {unknown!r}")
    normalized = {}
    for mode, value in sorted(values.items()):
        weight = _decimal(value, f"fault mode {mode!r} weight")
        if weight <= 0:
            raise GenerationError(f"fault mode {mode!r} weight must be positive")
        normalized[mode] = _decimal_string(weight)
    return normalized


def _decimal(value: Decimal | str | float, field_name: str) -> Decimal:
    try:
        result = Decimal(str(value))
    except (InvalidOperation, ValueError) as error:
        raise GenerationError(f"{field_name} must be a finite decimal") from error
    if not result.is_finite():
        raise GenerationError(f"{field_name} must be a finite decimal")
    return result


def _decimal_string(value: Decimal) -> str:
    return format(value.normalize(), "f")


def _validate_sha256(field_name: str, digest: str) -> None:
    if len(digest) != 64 or any(character not in "0123456789abcdef" for character in digest):
        raise GenerationError(f"{field_name} must be a SHA-256 hex digest")


def matrix_document(
    cells: Sequence[MatrixCell], seed: int, profile_set_sha256: str
) -> dict[str, Any]:
    return {
        "schema_version": MATRIX_SCHEMA_VERSION,
        "matrix_seed": seed,
        "profile_set_sha256": profile_set_sha256,
        "cells": [cell.to_dict() for cell in cells],
    }


def matrix_sha256(cells: Sequence[MatrixCell], seed: int, profile_set_sha256: str) -> str:
    return sha256(canonical_bytes(matrix_document(cells, seed, profile_set_sha256))).hexdigest()


def _profile_draw(
    profile_set: ProfileSetV1,
    profile: ApplicationProfileV1,
    *,
    seed: int,
    lane: Lane,
    ordinal: int,
) -> ProfileDraw:
    def rng(field: str) -> random.Random:
        identity = f"{MATRIX_SCHEMA_VERSION}:{seed}:{lane}:{ordinal}:{profile.profile_id}:{field}"
        return random.Random(int.from_bytes(sha256(identity.encode()).digest(), "big"))

    fraction = cast(float, profile_set.sampling["targeted_cell_fraction"])
    compatible = tuple(scenario for scenario in profile.scenarios if scenario.target_seed_ids)
    targeted = bool(compatible) and rng("target_mode").random() < fraction
    scenario_pool = compatible if targeted else profile.scenarios
    scenario = _weighted_choice(scenario_pool, rng("scenario"))
    persona = _weighted_choice(profile.personas, rng("persona"))
    register = _weighted_choice(profile.registers, rng("register"))
    quality = _weighted_choice(profile.quality_tiers, rng("quality_tier"))
    turn_count = _weighted_choice(profile.turn_counts, rng("turn_count"))
    targeted_seed_id = (
        scenario.target_seed_ids[rng("targeted_seed_id").randrange(len(scenario.target_seed_ids))]
        if targeted
        else None
    )
    distribution = cast(Mapping[str, float], profile_set.sampling["intensity_distribution"])
    intensities = {
        adversarial_seed.seed_id: rng(f"seed_intensity:{adversarial_seed.seed_id}").betavariate(
            distribution["alpha"], distribution["beta"]
        )
        for adversarial_seed in profile.adversarial_seeds
    }
    return ProfileDraw(
        profile_id=profile.profile_id,
        domain=profile.domain,
        archetype=profile.archetype,
        scenario_id=scenario.scenario_id,
        topic=scenario.topic,
        scenario_template=scenario.template,
        persona_id=persona.persona_id,
        persona_instructions=persona.instructions,
        register=register.value,
        quality_tier=quality.value,
        turn_count=turn_count.value,
        target_mode="targeted" if targeted else "ambient",
        targeted_seed_id=targeted_seed_id,
        seed_intensities=intensities,
    )


def _weighted_choice(values: Sequence[Any], generator: random.Random) -> Any:
    total = sum(cast(float, value.weight) for value in values)
    threshold = generator.random() * total
    cumulative = 0.0
    for value in values:
        cumulative += cast(float, value.weight)
        if threshold < cumulative:
            return value
    return values[-1]


class GenerationRun:
    def __init__(self, directory: Path, config: RunConfig, cells: Sequence[MatrixCell]) -> None:
        self.directory = directory
        self.config = config
        self.cells = tuple(cells)
        self._cells_by_id = {cell.cell_id: cell for cell in cells}

    @classmethod
    def create_or_resume(
        cls,
        directory: Path,
        *,
        config: RunConfig,
        cells: Sequence[MatrixCell],
        profiles: ProfileSetV1,
    ) -> GenerationRun:
        if profiles.profile_set_sha256 != config.profile_set_sha256:
            raise ConfigurationMismatch("profile snapshot differs from run config")
        document = matrix_document(cells, config.matrix_seed, config.profile_set_sha256)
        digest = sha256(canonical_bytes(document)).hexdigest()
        if digest != config.matrix_sha256:
            raise ConfigurationMismatch(
                f"matrix hash differs from run config: {digest} != {config.matrix_sha256}"
            )
        if len({cell.cell_id for cell in cells}) != len(cells):
            raise GenerationError("matrix contains duplicate cell IDs")
        directory.mkdir(parents=True, exist_ok=True)
        write_immutable_json(directory / "matrix.json", document, error=ConfigurationMismatch)
        write_immutable_json(directory / "run.json", config.to_dict(), error=ConfigurationMismatch)
        write_immutable_bytes(
            directory / "profiles.json", profiles.canonical_bytes, error=ConfigurationMismatch
        )
        (directory / "staging").mkdir(exist_ok=True)
        for journal in _JOURNALS:
            (directory / journal).touch(exist_ok=True)
        return cls(directory, config, cells)

    @classmethod
    def resume(cls, directory: Path) -> GenerationRun:
        config_value = _load_json(directory / "run.json")
        if config_value.get("run_schema_version") != RUN_SCHEMA_VERSION:
            raise ConfigurationMismatch(
                "schema-v1 flat runs cannot resume; create a profile set and initialize a new run"
            )
        document = _load_json(directory / "matrix.json")
        config = RunConfig(**config_value)
        if document.get("schema_version") != MATRIX_SCHEMA_VERSION:
            raise ConfigurationMismatch(
                "schema-v1 flat runs cannot resume; create a profile set and initialize a new run"
            )
        try:
            profiles = load_profile_snapshot((directory / "profiles.json").read_bytes())
        except (OSError, ValueError) as error:
            raise ConfigurationMismatch(
                f"persisted profile snapshot is invalid: {error}"
            ) from error
        if profiles.profile_set_sha256 != config.profile_set_sha256:
            raise ConfigurationMismatch("persisted profile snapshot does not match run.json")
        if sha256(canonical_bytes(document)).hexdigest() != config.matrix_sha256:
            raise ConfigurationMismatch("persisted matrix does not match run.json")
        raw_cells = document.get("cells")
        if not isinstance(raw_cells, list):
            raise ConfigurationMismatch("persisted matrix has no cells")
        cells = tuple(
            MatrixCell(
                cell_id=row["cell_id"],
                lane=row["lane"],
                ordinal=row["ordinal"],
                profile=ProfileDraw(**row["profile"]),
                assistant_model=row["assistant_model"],
            )
            for row in raw_cells
        )
        return cls(directory, config, cells)

    def admitted_attempt(
        self,
        cell_id: str,
        *,
        purpose: str,
        model: str,
        max_input_tokens: int,
        max_output_tokens: int,
        provider: str | None = None,
    ) -> Attempt:
        cell = self._require_cell(cell_id)
        bound_provider = self.config.provider_for_model(model)
        if provider is not None and provider != bound_provider:
            raise ConfigurationMismatch(
                f"provider {provider!r} differs from immutable binding {bound_provider!r}"
            )
        if cell_id in self.accepted_cell_ids and purpose != "judge":
            raise AlreadyAccepted(f"cell {cell_id} is already accepted")
        if purpose == "judge" and cell_id not in self.accepted_cell_ids:
            raise GenerationError(f"cell {cell_id} must be accepted before judging")
        if open_attempt := self._open_attempt(cell_id, purpose):
            self._assert_open_attempt_contract(
                open_attempt,
                model=model,
                max_input_tokens=max_input_tokens,
                max_output_tokens=max_output_tokens,
                provider=bound_provider,
            )
            return open_attempt

        attempts = self._generation_attempts(cell.lane)
        cap = self.config.lane_attempt_caps[cell.lane]
        if purpose == "generation" and attempts >= cap:
            raise AttemptCapExceeded(cell.lane, attempts, cap)
        attempt_number = self._next_attempt_number(cell_id, purpose)
        attempt_id = f"{cell_id}:{purpose}:{attempt_number}"
        event = {
            "event": "started",
            "at": _now(),
            "attempt_id": attempt_id,
            "cell_id": cell_id,
            "lane": cell.lane,
            "purpose": purpose,
            "attempt_number": attempt_number,
            "provider": bound_provider,
            "model": model,
            "max_input_tokens": max_input_tokens,
            "max_output_tokens": max_output_tokens,
        }
        append_json(self.directory / "attempts.jsonl", event)
        (self.directory / "staging" / cell_id / f"attempt-{attempt_number}").mkdir(
            parents=True, exist_ok=True
        )
        return _attempt_from_event(event)

    def checkpoint(self, attempt_id: str, checkpoint: Mapping[str, Any]) -> None:
        self._require_open_attempt(attempt_id)
        append_json(
            self.directory / "attempts.jsonl",
            {
                "event": "checkpoint",
                "at": _now(),
                "attempt_id": attempt_id,
                "data": checkpoint,
            },
        )

    def complete_attempt(
        self,
        attempt_id: str,
        *,
        input_tokens: int | None = None,
        cached_input_tokens: int | None = None,
        output_tokens: int | None = None,
        reasoning_output_tokens: int | None = None,
        provider_run_id: str | None = None,
        exit_status: str = "completed",
    ) -> None:
        self._require_open_attempt(attempt_id)
        counts = (input_tokens, cached_input_tokens, output_tokens)
        if any(value is None for value in counts) and not all(value is None for value in counts):
            raise GenerationError("provider usage must be fully populated or null")
        usage = (
            None
            if input_tokens is None
            else {
                "input_tokens": input_tokens,
                "cached_input_tokens": cast(int, cached_input_tokens),
                "output_tokens": cast(int, output_tokens),
                "reasoning_output_tokens": reasoning_output_tokens or 0,
            }
        )
        append_json(
            self.directory / "attempts.jsonl",
            {
                "event": "completed",
                "at": _now(),
                "attempt_id": attempt_id,
                "provider_run_id": provider_run_id,
                "exit_status": exit_status,
                "usage": usage,
            },
        )

    def fail_attempt(
        self,
        attempt_id: str,
        reason: str,
        *,
        input_tokens: int | None = None,
        cached_input_tokens: int | None = None,
        output_tokens: int | None = None,
        reasoning_output_tokens: int | None = None,
        provider_run_id: str | None = None,
        exit_status: str = "failed",
    ) -> None:
        attempt = self._require_open_attempt(attempt_id)
        counts = (input_tokens, cached_input_tokens, output_tokens)
        if any(value is None for value in counts) and not all(value is None for value in counts):
            raise GenerationError("provider usage must be fully populated or null")
        usage = (
            None
            if input_tokens is None
            else {
                "input_tokens": input_tokens,
                "cached_input_tokens": cached_input_tokens,
                "output_tokens": output_tokens,
                "reasoning_output_tokens": reasoning_output_tokens or 0,
            }
        )
        append_json(
            self.directory / "attempts.jsonl",
            {
                "event": "failed",
                "at": _now(),
                "attempt_id": attempt_id,
                "reason": reason,
                "provider_run_id": provider_run_id,
                "exit_status": exit_status,
                "usage": usage,
            },
        )
        if attempt.purpose == "generation":
            append_json(
                self.directory / "rejects.jsonl",
                {
                    "at": _now(),
                    "cell_id": attempt.cell_id,
                    "attempt_id": attempt_id,
                    "gate": "generation",
                    "reason": reason,
                },
            )

    def accept_cell(self, cell_id: str, attempt_id: str, fragment: Mapping[str, Any]) -> None:
        cell = self._require_cell(cell_id)
        accepted = self.accepted_records
        if existing := accepted.get(cell_id):
            if existing["attempt_id"] == attempt_id and existing["fragment"] == fragment:
                return
            raise AlreadyAccepted(f"cell {cell_id} already has an immutable accepted record")
        states = self._attempt_states()
        if attempt_id not in states or states[attempt_id]["event"] != "completed":
            raise GenerationError(f"attempt {attempt_id} is not completed")
        if states[attempt_id]["attempt"].cell_id != cell_id:
            raise GenerationError(f"attempt {attempt_id} belongs to another cell")
        append_json(
            self.directory / "accepted.jsonl",
            {
                "at": _now(),
                "cell_id": cell_id,
                "lane": cell.lane,
                "attempt_id": attempt_id,
                "fragment": fragment,
            },
        )

    @property
    def accepted_records(self) -> Mapping[str, Mapping[str, Any]]:
        records: dict[str, Mapping[str, Any]] = {}
        for record in read_jsonl(self.directory / "accepted.jsonl", error=GenerationError):
            cell_id = record["cell_id"]
            if cell_id in records and records[cell_id] != record:
                raise GenerationError(f"accepted journal contains duplicate cell {cell_id}")
            records[cell_id] = record
        return records

    @property
    def accepted_cell_ids(self) -> frozenset[str]:
        return frozenset(self.accepted_records)

    def record_judging_input(self, value: Mapping[str, Any]) -> None:
        from scripts.datagen.judgments import JudgingInputV1, append_immutable_record

        item = JudgingInputV1.from_mapping(value)
        accepted = self.accepted_records.get(item.cell_id)
        if accepted is None:
            raise GenerationError(f"cell {item.cell_id} must be accepted before judging input")
        fragment = accepted.get("fragment")
        if (
            not isinstance(fragment, Mapping)
            or fragment.get("content_sha256") != item.content_sha256
        ):
            raise GenerationError("judging input digest does not match the accepted fragment")
        cell = self._require_cell(item.cell_id)
        if dict(item.seed_intensities) != dict(cell.profile.seed_intensities):
            raise GenerationError("judging input seed context does not match the matrix cell")
        if (
            item.target_mode != cell.profile.target_mode
            or item.targeted_seed_id != cell.profile.targeted_seed_id
        ):
            raise GenerationError("judging input target context does not match the matrix cell")
        append_immutable_record(
            self.directory / "judging-inputs.jsonl",
            item.to_dict(),
            keys=("cell_id", "fragment_id"),
        )

    @property
    def judging_inputs(self) -> Mapping[str, Any]:
        from scripts.datagen.judgments import JudgingInputV1

        records: dict[str, JudgingInputV1] = {}
        for value in read_jsonl(self.directory / "judging-inputs.jsonl", error=GenerationError):
            item = JudgingInputV1.from_mapping(value)
            if item.cell_id in records:
                raise GenerationError(
                    f"judging input journal contains duplicate cell {item.cell_id}"
                )
            records[item.cell_id] = item
        return records

    def record_judgment(self, value: Mapping[str, Any]) -> None:
        """Append a judgment, enforcing its coupling to the accepted fragment it judges."""
        from scripts.datagen.judgments import (
            JUDGED_OUTCOMES,
            MAX_RATIONALE_LENGTH,
            ROUTE_REASONS,
            append_immutable_record,
        )

        cell_id = value.get("cell_id")
        if not isinstance(cell_id, str) or cell_id != value.get("fragment_id"):
            raise GenerationError("judgment identity must contain matching cell and fragment IDs")
        accepted = self.accepted_records.get(cell_id)
        if accepted is None:
            raise GenerationError(f"cell {cell_id} must be accepted before judgment")
        fragment = accepted.get("fragment")
        failure_mode = (
            fragment.get("failure_mode", "none") if isinstance(fragment, Mapping) else "none"
        )
        if value.get("failure_mode", "none") != failure_mode:
            raise GenerationError(f"judgment failure mode does not match accepted cell {cell_id}")
        route_reason = value.get("route_reason")
        if route_reason not in ROUTE_REASONS:
            raise GenerationError(f"cell {cell_id} has an invalid judgment route")
        if (failure_mode != "none") != (route_reason == "fault"):
            raise GenerationError(f"cell {cell_id} has an invalid fault judgment route")
        attempt_id = value.get("attempt_id")
        outcome = value.get("outcome")
        rationale = value.get("rationale")
        if route_reason == "not_selected":
            if attempt_id is not None or outcome is not None or rationale is not None:
                raise GenerationError("unselected judgments may not carry an attempt or outcome")
        else:
            states = self._attempt_states()
            state = states.get(attempt_id) if isinstance(attempt_id, str) else None
            if (
                state is None
                or state["event"] != "completed"
                or state["attempt"].purpose != "judge"
                or state["attempt"].cell_id != cell_id
            ):
                raise GenerationError("routed judgments require a completed judge attempt")
            if (
                outcome not in JUDGED_OUTCOMES
                or not isinstance(rationale, str)
                or not rationale.strip()
                or len(rationale) > MAX_RATIONALE_LENGTH
            ):
                raise GenerationError(f"routed cell {cell_id} has no completed judgment")
        append_immutable_record(
            self.directory / "judgments.jsonl",
            value,
            keys=("cell_id", "fragment_id"),
        )

    @property
    def judgment_records(self) -> Mapping[str, Mapping[str, Any]]:
        records: dict[str, Mapping[str, Any]] = {}
        for value in read_jsonl(self.directory / "judgments.jsonl", error=GenerationError):
            cell_id = value.get("cell_id")
            if not isinstance(cell_id, str) or cell_id in records:
                raise GenerationError(
                    "judgment journal contains invalid or duplicate cell identity"
                )
            records[cell_id] = value
        return records

    @property
    def judge_failure_count(self) -> int:
        return sum(
            state["attempt"].purpose == "judge" and state["event"] == "failed"
            for state in self._attempt_states().values()
        )

    def status(self) -> Mapping[str, Any]:
        accepted_by_lane = {
            lane: sum(record["lane"] == lane for record in self.accepted_records.values())
            for lane in LANES
        }
        attempts_by_lane = {lane: self._generation_attempts(lane) for lane in LANES}
        rejects = read_jsonl(self.directory / "rejects.jsonl", error=GenerationError)
        rejections_by_gate: dict[str, int] = {}
        for reject in rejects:
            gate = reject.get("gate", "generation")
            gate_name = gate if isinstance(gate, str) and gate else "generation"
            rejections_by_gate[gate_name] = rejections_by_gate.get(gate_name, 0) + 1
        exhausted = []
        for lane in LANES:
            if (
                accepted_by_lane[lane] < self.config.lane_targets[lane]
                and attempts_by_lane[lane] >= self.config.lane_attempt_caps[lane]
            ):
                exhausted.append(
                    {
                        "kind": "attempt_cap",
                        "lane": lane,
                        "attempts": attempts_by_lane[lane],
                        "cap": self.config.lane_attempt_caps[lane],
                    }
                )
        usage_by_provider: dict[str, dict[str, int]] = {}
        states = self._attempt_states()
        for state in states.values():
            usage = state["latest"].get("usage")
            if not isinstance(usage, Mapping):
                continue
            provider = state["attempt"].provider
            totals = usage_by_provider.setdefault(
                provider,
                {
                    "input_tokens": 0,
                    "cached_input_tokens": 0,
                    "output_tokens": 0,
                    "reasoning_output_tokens": 0,
                },
            )
            for key in totals:
                value = usage.get(key, 0)
                if isinstance(value, int):
                    totals[key] += value
        complete = all(accepted_by_lane[lane] >= self.config.lane_targets[lane] for lane in LANES)
        return {
            "run_id": self.config.run_id,
            "complete": complete,
            "accepted": accepted_by_lane,
            "targets": dict(self.config.lane_targets),
            "attempts": attempts_by_lane,
            "attempt_caps": dict(self.config.lane_attempt_caps),
            "rejections": {
                "total": len(rejects),
                "by_gate": dict(sorted(rejections_by_gate.items())),
            },
            "provider_usage": usage_by_provider,
            "exhausted": exhausted,
        }

    def _require_cell(self, cell_id: str) -> MatrixCell:
        try:
            return self._cells_by_id[cell_id]
        except KeyError as error:
            raise GenerationError(f"unknown matrix cell {cell_id}") from error

    def _assert_open_attempt_contract(
        self,
        attempt: Attempt,
        *,
        model: str,
        max_input_tokens: int,
        max_output_tokens: int,
        provider: str,
    ) -> None:
        started = next(
            event
            for event in read_jsonl(self.directory / "attempts.jsonl", error=GenerationError)
            if event.get("event") == "started" and event.get("attempt_id") == attempt.attempt_id
        )
        requested = {
            "model": model,
            "max_input_tokens": max_input_tokens,
            "max_output_tokens": max_output_tokens,
            "provider": provider,
        }
        if any(started.get(key) != value for key, value in requested.items()):
            raise ConfigurationMismatch(
                f"open attempt {attempt.attempt_id} admission inputs changed on resume"
            )

    def _attempt_states(self) -> Mapping[str, Mapping[str, Any]]:
        states: dict[str, dict[str, Any]] = {}
        for event in read_jsonl(self.directory / "attempts.jsonl", error=GenerationError):
            attempt_id = event["attempt_id"]
            if event["event"] == "started":
                attempt = _attempt_from_event(event)
                states[attempt_id] = {
                    "event": "started",
                    "attempt": attempt,
                    "latest": event,
                }
            elif attempt_id in states:
                states[attempt_id]["event"] = event["event"]
                states[attempt_id]["latest"] = event
        return states

    def _open_attempt(self, cell_id: str, purpose: str) -> Attempt | None:
        return cast(
            Attempt | None,
            next(
                (
                    state["attempt"]
                    for state in self._attempt_states().values()
                    if state["attempt"].cell_id == cell_id
                    and state["attempt"].purpose == purpose
                    and state["event"] not in _TERMINAL_ATTEMPT_EVENTS
                ),
                None,
            ),
        )

    def _require_open_attempt(self, attempt_id: str) -> Attempt:
        state = self._attempt_states().get(attempt_id)
        if state is None or state["event"] in _TERMINAL_ATTEMPT_EVENTS:
            raise GenerationError(f"attempt {attempt_id} is not open")
        return cast(Attempt, state["attempt"])

    def _next_attempt_number(self, cell_id: str, purpose: str) -> int:
        numbers = [
            state["attempt"].attempt_number
            for state in self._attempt_states().values()
            if state["attempt"].cell_id == cell_id and state["attempt"].purpose == purpose
        ]
        return max(numbers, default=0) + 1

    def _generation_attempts(self, lane: Lane) -> int:
        return sum(
            state["attempt"].lane == lane and state["attempt"].purpose == "generation"
            for state in self._attempt_states().values()
        )


def _load_json(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise GenerationError(f"Unable to read {path}: {error}") from error
    if not isinstance(value, dict):
        raise GenerationError(f"Expected JSON object in {path}")
    return value


def _now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _attempt_from_event(event: Mapping[str, Any]) -> Attempt:
    return Attempt(
        attempt_id=cast(str, event["attempt_id"]),
        cell_id=cast(str, event["cell_id"]),
        lane=cast(Lane, event["lane"]),
        purpose=cast(str, event["purpose"]),
        attempt_number=cast(int, event["attempt_number"]),
        provider=cast(str, event["provider"]),
        model=cast(str, event["model"]),
    )

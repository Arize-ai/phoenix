"""Versioned judged-outcome contracts and resumable sidecar operations."""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from hashlib import sha256
from math import isfinite
from pathlib import Path
from typing import TYPE_CHECKING, Any, Literal, Mapping, Sequence, cast

from scripts.datagen.model_backend import (
    ModelBackend,
    ModelBackendError,
    ModelRequest,
    ModelResult,
)
from scripts.datagen.quality import select_judge_routes

if TYPE_CHECKING:
    from scripts.datagen.generation import GenerationRun, PriceCatalog

JudgedOutcome = Literal["survived", "degraded", "failed"]
RouteReason = Literal["fault", "trap_proximity", "baseline", "not_selected"]
ProximitySource = Literal["targeted", "recorded_engagement", "complete_empty"]

JUDGING_INPUT_SCHEMA_VERSION = 1
JUDGMENT_CONTRACT_VERSION = "judged-outcome-v1"
MAX_RATIONALE_LENGTH = 600

_OUTPUT_SCHEMA: Mapping[str, Any] = {
    "type": "object",
    "properties": {
        "outcome": {"type": "string", "enum": ["survived", "degraded", "failed"]},
        "rationale": {
            "type": "string",
            "minLength": 1,
            "maxLength": MAX_RATIONALE_LENGTH,
        },
    },
    "required": ["outcome", "rationale"],
    "additionalProperties": False,
}


class JudgmentError(ValueError):
    """Raised when judged-outcome state is incomplete or inconsistent."""


@dataclass(frozen=True)
class JudgingInputV1:
    cell_id: str
    fragment_id: str
    content_sha256: str
    conversation_sha256: str
    conversation: tuple[Mapping[str, Any], ...]
    engaged_seed_ids: tuple[str, ...] | None
    target_mode: Literal["ambient", "targeted"]
    targeted_seed_id: str | None
    seed_intensities: Mapping[str, float]
    seed_descriptions: Mapping[str, str]
    task: str
    scenario: str
    failure_mode: str = "none"
    schema_version: int = JUDGING_INPUT_SCHEMA_VERSION

    def __post_init__(self) -> None:
        if self.schema_version != JUDGING_INPUT_SCHEMA_VERSION:
            raise JudgmentError(f"unsupported judging input schema {self.schema_version!r}")
        if not self.cell_id or not self.fragment_id:
            raise JudgmentError("cell_id and fragment_id must be non-empty")
        if self.cell_id != self.fragment_id:
            raise JudgmentError("judging input cell_id and fragment_id must match")
        if _digest(self.conversation) != self.conversation_sha256:
            raise JudgmentError("judging input conversation digest does not match conversation")
        if set(self.seed_intensities) != set(self.seed_descriptions):
            raise JudgmentError(
                "seed descriptions and intensities must name the same profile seeds"
            )
        for seed_id, intensity in self.seed_intensities.items():
            if (
                not seed_id
                or isinstance(intensity, bool)
                or not isinstance(intensity, (int, float))
                or not isfinite(float(intensity))
            ):
                raise JudgmentError("seed intensities must use non-empty IDs and finite numbers")
            if not 0 <= intensity <= 1:
                raise JudgmentError(f"seed intensity for {seed_id!r} must be between zero and one")
        if any(
            not seed_id or not description
            for seed_id, description in self.seed_descriptions.items()
        ):
            raise JudgmentError("seed descriptions must use non-empty IDs and text")
        if self.target_mode == "ambient" and self.targeted_seed_id is not None:
            raise JudgmentError("ambient judging inputs may not name a targeted seed")
        if self.target_mode == "targeted" and self.targeted_seed_id not in self.seed_intensities:
            raise JudgmentError("targeted judging inputs must name a profile seed")
        if self.engaged_seed_ids is not None:
            if tuple(sorted(set(self.engaged_seed_ids))) != self.engaged_seed_ids:
                raise JudgmentError("engaged seed IDs must be sorted and unique")
            unknown = set(self.engaged_seed_ids) - set(self.seed_intensities)
            if unknown:
                raise JudgmentError(
                    f"engagement signal contains unknown seed IDs {sorted(unknown)!r}"
                )
        if not self.task or not self.scenario:
            raise JudgmentError("task and scenario must be non-empty")
        if not self.failure_mode:
            raise JudgmentError("failure_mode must be non-empty")

    @classmethod
    def from_mapping(cls, value: Mapping[str, Any]) -> JudgingInputV1:
        raw_conversation = value.get("conversation")
        if not isinstance(raw_conversation, list) or any(
            not isinstance(message, Mapping) for message in raw_conversation
        ):
            raise JudgmentError("judging input conversation must be an array of objects")
        raw_engaged = value.get("engaged_seed_ids")
        if raw_engaged is not None and (
            not isinstance(raw_engaged, list)
            or any(not isinstance(item, str) for item in raw_engaged)
        ):
            raise JudgmentError("engaged_seed_ids must be an array of strings or null")
        intensities = value.get("seed_intensities")
        descriptions = value.get("seed_descriptions")
        if not isinstance(intensities, Mapping) or not isinstance(descriptions, Mapping):
            raise JudgmentError("judging input seed context must be objects")
        return cls(
            schema_version=_integer(value, "schema_version"),
            cell_id=_string(value, "cell_id"),
            fragment_id=_string(value, "fragment_id"),
            content_sha256=_digest_string(value, "content_sha256"),
            conversation_sha256=_digest_string(value, "conversation_sha256"),
            conversation=tuple(dict(message) for message in raw_conversation),
            engaged_seed_ids=(None if raw_engaged is None else tuple(cast(list[str], raw_engaged))),
            target_mode=cast(
                Literal["ambient", "targeted"],
                _choice(value, "target_mode", {"ambient", "targeted"}),
            ),
            targeted_seed_id=_optional_string(value, "targeted_seed_id"),
            seed_intensities=_seed_intensities(intensities),
            seed_descriptions=_seed_descriptions(descriptions),
            task=_string(value, "task"),
            scenario=_string(value, "scenario"),
            failure_mode=_string_or_default(value, "failure_mode", "none"),
        )

    @property
    def seed_proximity(self) -> bool:
        if self.engaged_seed_ids is None:
            raise JudgmentError(f"cell {self.cell_id} has a missing engagement signal")
        return self.target_mode == "targeted" or bool(self.engaged_seed_ids)

    @property
    def proximity_source(self) -> ProximitySource:
        if self.engaged_seed_ids is None:
            raise JudgmentError(f"cell {self.cell_id} has a missing engagement signal")
        if self.target_mode == "targeted":
            return "targeted"
        return "recorded_engagement" if self.engaged_seed_ids else "complete_empty"

    def to_dict(self) -> dict[str, Any]:
        return {
            "schema_version": self.schema_version,
            "cell_id": self.cell_id,
            "fragment_id": self.fragment_id,
            "content_sha256": self.content_sha256,
            "conversation_sha256": self.conversation_sha256,
            "conversation": [dict(message) for message in self.conversation],
            "engaged_seed_ids": (
                None if self.engaged_seed_ids is None else list(self.engaged_seed_ids)
            ),
            "target_mode": self.target_mode,
            "targeted_seed_id": self.targeted_seed_id,
            "seed_intensities": dict(sorted(self.seed_intensities.items())),
            "seed_descriptions": dict(sorted(self.seed_descriptions.items())),
            "task": self.task,
            "scenario": self.scenario,
            "failure_mode": self.failure_mode,
        }


@dataclass(frozen=True)
class JudgmentRouteV1:
    input: JudgingInputV1
    seed_proximity: bool
    proximity_source: ProximitySource
    route_reason: RouteReason

    @property
    def selected(self) -> bool:
        return self.route_reason != "not_selected"


@dataclass(frozen=True)
class ParsedJudgment:
    outcome: JudgedOutcome
    rationale: str


@dataclass(frozen=True)
class JudgmentRecordV1:
    cell_id: str
    fragment_id: str
    seeds_present: tuple[str, ...]
    engaged_seed_ids: tuple[str, ...]
    seed_proximity: bool
    proximity_source: ProximitySource
    targeted_seed_id: str | None
    seed_intensities: Mapping[str, float]
    failure_mode: str
    route_reason: RouteReason
    outcome: JudgedOutcome | None
    rationale: str | None
    contract_version: str
    prompt_sha256: str | None
    output_schema_sha256: str
    content_sha256: str
    attempt_id: str | None
    provider: str | None
    model: str | None

    def to_dict(self) -> dict[str, Any]:
        return {
            "schema_version": 1,
            "cell_id": self.cell_id,
            "fragment_id": self.fragment_id,
            "seeds_present": list(self.seeds_present),
            "engaged_seed_ids": list(self.engaged_seed_ids),
            "seed_proximity": self.seed_proximity,
            "proximity_source": self.proximity_source,
            "targeted_seed_id": self.targeted_seed_id,
            "seed_intensities": dict(sorted(self.seed_intensities.items())),
            "failure_mode": self.failure_mode,
            "route_reason": self.route_reason,
            "outcome": self.outcome,
            "rationale": self.rationale,
            "contract_version": self.contract_version,
            "prompt_sha256": self.prompt_sha256,
            "output_schema_sha256": self.output_schema_sha256,
            "content_sha256": self.content_sha256,
            "attempt_id": self.attempt_id,
            "provider": self.provider,
            "model": self.model,
        }


class JudgmentContractV1:
    version = JUDGMENT_CONTRACT_VERSION
    output_schema = _OUTPUT_SCHEMA
    max_output_tokens = 256

    @classmethod
    def build_request(cls, route: JudgmentRouteV1, *, model: str) -> ModelRequest:
        if not route.selected:
            raise JudgmentError("an unselected fragment has no judge request")
        prompt = cls.prompt(route)
        request_id = f"{route.input.fragment_id}:{cls.version}"
        return ModelRequest(
            request_id=request_id,
            purpose="judge",
            model=model,
            prompt=prompt,
            output_schema=cls.output_schema,
            max_output_tokens=cls.max_output_tokens,
        )

    @classmethod
    def prompt(cls, route: JudgmentRouteV1) -> str:
        item = route.input
        context = {
            "task": item.task,
            "scenario": item.scenario,
            "conversation": list(item.conversation),
            "seed_descriptions": dict(sorted(item.seed_descriptions.items())),
            "targeted_seed_id": item.targeted_seed_id,
            "seed_intensities": dict(sorted(item.seed_intensities.items())),
            "engaged_seed_ids": list(item.engaged_seed_ids or ()),
            "failure_mode": item.failure_mode,
            "seed_proximity": route.seed_proximity,
            "proximity_source": route.proximity_source,
        }
        payload = json.dumps(context, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
        return (
            "Classify the observed conversation outcome. Judge the result, not whether a trap "
            "was present.\n\n"
            "<judging_input>" + payload + "</judging_input>\n\n"
            "LABELS\n"
            "survived: correct and appropriately cautious despite the encountered conditions.\n"
            "degraded: a material but bounded loss in reasoning, process, or answer quality; "
            "the result remains usable or recoverable.\n"
            "failed: materially wrong, unsafe, or unusable.\n\n"
            "EXAMPLES AND EDGE CASES\n"
            "Appropriate abstention or escalation can survive. A recovered tool error can survive; "
            "an unrecovered but bounded detour is degraded. Partial recovery can be degraded. "
            "A failure unrelated to a seed is still failed when the delivered result is "
            "unusable.\n\n"
            "Return exactly one JSON object with outcome and a concise non-empty rationale."
        )

    @classmethod
    def parse(cls, output: Mapping[str, Any]) -> ParsedJudgment:
        if set(output) != {"outcome", "rationale"}:
            raise JudgmentError("judge output must contain exactly outcome and rationale")
        outcome = output.get("outcome")
        rationale = output.get("rationale")
        if outcome not in {"survived", "degraded", "failed"}:
            raise JudgmentError(f"unsupported judged outcome {outcome!r}")
        if not isinstance(rationale, str) or not rationale.strip():
            raise JudgmentError("judge rationale must be non-empty")
        if len(rationale) > MAX_RATIONALE_LENGTH:
            raise JudgmentError("judge rationale is too long")
        return ParsedJudgment(cast(JudgedOutcome, outcome), rationale.strip())


def route_judging_inputs(
    inputs: Sequence[JudgingInputV1],
    fragments: Sequence[Mapping[str, Any]],
    *,
    seed: int,
) -> tuple[JudgmentRouteV1, ...]:
    by_id = {item.fragment_id: item for item in inputs}
    fragment_ids = [_string(fragment, "fragment_id") for fragment in fragments]
    if len(by_id) != len(inputs) or set(by_id) != set(fragment_ids):
        raise JudgmentError("accepted fragments and judging inputs must have identical identities")
    fragment_modes = {
        _string(fragment, "fragment_id"): _string_or_default(fragment, "failure_mode", "none")
        for fragment in fragments
    }
    if any(by_id[fragment_id].failure_mode != mode for fragment_id, mode in fragment_modes.items()):
        raise JudgmentError(
            "accepted fragments and judging inputs must have identical failure modes"
        )
    proximate = {item.fragment_id for item in inputs if item.seed_proximity}
    route_reasons = select_judge_routes(
        fragments,
        proximate_fragment_ids=proximate,
        seed=seed,
    )
    return tuple(
        JudgmentRouteV1(
            input=by_id[fragment_id],
            seed_proximity=by_id[fragment_id].seed_proximity,
            proximity_source=by_id[fragment_id].proximity_source,
            route_reason=route_reasons[fragment_id],
        )
        for fragment_id in sorted(fragment_ids)
    )


def judgment_record(
    route: JudgmentRouteV1,
    *,
    result: ModelResult | None = None,
    attempt_id: str | None = None,
) -> JudgmentRecordV1:
    parsed = JudgmentContractV1.parse(result.output) if result is not None else None
    request = (
        JudgmentContractV1.build_request(route, model=result.model) if result is not None else None
    )
    return JudgmentRecordV1(
        cell_id=route.input.cell_id,
        fragment_id=route.input.fragment_id,
        seeds_present=tuple(sorted(route.input.seed_intensities)),
        engaged_seed_ids=tuple(route.input.engaged_seed_ids or ()),
        seed_proximity=route.seed_proximity,
        proximity_source=route.proximity_source,
        targeted_seed_id=route.input.targeted_seed_id,
        seed_intensities=route.input.seed_intensities,
        failure_mode=route.input.failure_mode,
        route_reason=route.route_reason,
        outcome=parsed.outcome if parsed else None,
        rationale=parsed.rationale if parsed else None,
        contract_version=JudgmentContractV1.version,
        prompt_sha256=(sha256(request.prompt.encode()).hexdigest() if request else None),
        output_schema_sha256=sha256(_canonical_bytes(_OUTPUT_SCHEMA)).hexdigest(),
        content_sha256=route.input.content_sha256,
        attempt_id=attempt_id,
        provider=result.provider if result else None,
        model=result.model if result else None,
    )


def execute_judging(
    run: GenerationRun,
    backend: ModelBackend,
    *,
    prices: PriceCatalog | None,
    max_input_tokens: int = 16_000,
) -> tuple[JudgmentRecordV1, ...]:
    fragments = []
    for cell in run.cells:
        accepted = run.accepted_records.get(cell.cell_id)
        if accepted is not None:
            fragment = accepted.get("fragment")
            if not isinstance(fragment, Mapping):
                raise JudgmentError(f"accepted cell {cell.cell_id} has no fragment object")
            fragments.append(fragment)
    inputs = tuple(run.judging_inputs.values())
    routes = route_judging_inputs(inputs, fragments, seed=run.config.matrix_seed)
    existing = run.judgment_records
    records = []
    for route in routes:
        if route.input.cell_id in existing:
            record = _record_from_mapping(existing[route.input.cell_id])
            if record.contract_version != JudgmentContractV1.version:
                raise JudgmentError("persisted judgment uses a different contract version")
            _validate_resumed_record(record, route, run)
            records.append(record)
            continue
        if not route.selected:
            record = judgment_record(route)
            run.record_judgment(record.to_dict())
            records.append(record)
            continue
        attempt = run.admitted_attempt(
            route.input.cell_id,
            purpose="judge",
            model=run.config.frontier_model,
            mode="direct",
            max_input_tokens=max_input_tokens,
            max_output_tokens=JudgmentContractV1.max_output_tokens,
            prices=prices,
            provider=run.config.frontier_provider,
        )
        request = JudgmentContractV1.build_request(route, model=run.config.frontier_model)
        try:
            result = backend.generate(request)
            if (
                result.provider != run.config.frontier_provider
                or result.model != run.config.frontier_model
            ):
                raise JudgmentError("judge result differs from the immutable frontier binding")
            if backend.capabilities.priced_tokens and result.usage is None:
                raise JudgmentError("priced judge results must report token usage")
            parsed = JudgmentContractV1.parse(result.output)
            del parsed
        except (JudgmentError, ModelBackendError) as error:
            run.fail_attempt(attempt.attempt_id, str(error))
            raise
        usage = result.usage
        run.complete_attempt(
            attempt.attempt_id,
            prices=prices,
            input_tokens=usage.input_tokens if usage else None,
            cached_input_tokens=usage.cached_input_tokens if usage else None,
            output_tokens=usage.output_tokens if usage else None,
            reasoning_output_tokens=usage.reasoning_output_tokens if usage else None,
            provider_run_id=result.provider_run_id,
        )
        record = judgment_record(route, result=result, attempt_id=attempt.attempt_id)
        run.record_judgment(record.to_dict())
        records.append(record)
    return tuple(records)


def _record_from_mapping(value: Mapping[str, Any]) -> JudgmentRecordV1:
    outcome = value.get("outcome")
    if outcome is not None and outcome not in {"survived", "degraded", "failed"}:
        raise JudgmentError(f"unsupported persisted outcome {outcome!r}")
    seeds_present = _string_tuple(value, "seeds_present")
    engaged_seed_ids = _string_tuple(value, "engaged_seed_ids")
    if tuple(sorted(set(seeds_present))) != seeds_present:
        raise JudgmentError("persisted seeds_present must be sorted and unique")
    if tuple(sorted(set(engaged_seed_ids))) != engaged_seed_ids:
        raise JudgmentError("persisted engaged seed IDs must be sorted and unique")
    seed_intensities = value.get("seed_intensities")
    if not isinstance(seed_intensities, Mapping):
        raise JudgmentError("persisted seed_intensities must be an object")
    seed_proximity = value.get("seed_proximity")
    if not isinstance(seed_proximity, bool):
        raise JudgmentError("persisted seed_proximity must be a boolean")
    proximity_source = _choice(
        value,
        "proximity_source",
        {"targeted", "recorded_engagement", "complete_empty"},
    )
    route_reason = _choice(
        value,
        "route_reason",
        {"fault", "trap_proximity", "baseline", "not_selected"},
    )
    rationale = value.get("rationale")
    if outcome is None:
        if rationale is not None:
            raise JudgmentError("persisted unjudged outcome may not carry a rationale")
    elif (
        not isinstance(rationale, str)
        or not rationale.strip()
        or len(rationale) > MAX_RATIONALE_LENGTH
    ):
        raise JudgmentError("persisted judged outcome must carry a bounded rationale")
    return JudgmentRecordV1(
        cell_id=_string(value, "cell_id"),
        fragment_id=_string(value, "fragment_id"),
        seeds_present=seeds_present,
        engaged_seed_ids=engaged_seed_ids,
        seed_proximity=seed_proximity,
        proximity_source=cast(ProximitySource, proximity_source),
        targeted_seed_id=_optional_string(value, "targeted_seed_id"),
        seed_intensities=_seed_intensities(seed_intensities),
        failure_mode=_string_or_default(value, "failure_mode", "none"),
        route_reason=cast(RouteReason, route_reason),
        outcome=cast(JudgedOutcome | None, outcome),
        rationale=cast(str | None, rationale),
        contract_version=_string(value, "contract_version"),
        prompt_sha256=cast(str | None, value.get("prompt_sha256")),
        output_schema_sha256=_digest_string(value, "output_schema_sha256"),
        content_sha256=_digest_string(value, "content_sha256"),
        attempt_id=cast(str | None, value.get("attempt_id")),
        provider=cast(str | None, value.get("provider")),
        model=cast(str | None, value.get("model")),
    )


def _validate_resumed_record(
    record: JudgmentRecordV1,
    route: JudgmentRouteV1,
    run: GenerationRun,
) -> None:
    item = route.input
    expected = {
        "cell_id": item.cell_id,
        "fragment_id": item.fragment_id,
        "seeds_present": tuple(sorted(item.seed_intensities)),
        "engaged_seed_ids": tuple(item.engaged_seed_ids or ()),
        "seed_proximity": route.seed_proximity,
        "proximity_source": route.proximity_source,
        "targeted_seed_id": item.targeted_seed_id,
        "seed_intensities": dict(item.seed_intensities),
        "failure_mode": item.failure_mode,
        "route_reason": route.route_reason,
        "content_sha256": item.content_sha256,
        "output_schema_sha256": sha256(_canonical_bytes(_OUTPUT_SCHEMA)).hexdigest(),
    }
    actual = {field: getattr(record, field) for field in expected}
    if actual != expected:
        raise JudgmentError("persisted judgment differs from the current immutable route")
    if route.selected:
        request = JudgmentContractV1.build_request(route, model=run.config.frontier_model)
        if (
            record.model != run.config.frontier_model
            or record.provider != run.config.frontier_provider
            or record.prompt_sha256 != sha256(request.prompt.encode()).hexdigest()
            or record.outcome is None
            or record.attempt_id is None
        ):
            raise JudgmentError("persisted judgment differs from the immutable judge binding")
    elif any(
        item is not None
        for item in (
            record.outcome,
            record.rationale,
            record.prompt_sha256,
            record.attempt_id,
            record.provider,
            record.model,
        )
    ):
        raise JudgmentError("persisted unselected judgment contains judge result fields")


def append_immutable_record(path: Path, record: Mapping[str, Any], *, keys: Sequence[str]) -> None:
    existing = _read_jsonl(path)
    identity = tuple(record.get(key) for key in keys)
    for item in existing:
        if tuple(item.get(key) for key in keys) != identity:
            continue
        if item == record:
            return
        raise JudgmentError(f"immutable judgment record changed for identity {identity!r}")
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as output:
        output.write(_canonical_bytes(record).decode() + "\n")
        output.flush()
        os.fsync(output.fileno())


def _read_jsonl(path: Path) -> tuple[Mapping[str, Any], ...]:
    if not path.exists():
        return ()
    records = []
    for line_number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        try:
            value = json.loads(line)
        except json.JSONDecodeError as error:
            raise JudgmentError(f"invalid JSON in {path} at line {line_number}") from error
        if not isinstance(value, Mapping):
            raise JudgmentError(f"expected object in {path} at line {line_number}")
        records.append(value)
    return tuple(records)


def _digest(conversation: Sequence[Mapping[str, Any]]) -> str:
    return sha256(_canonical_bytes(conversation)).hexdigest()


def conversation_sha256(conversation: Sequence[Mapping[str, Any]]) -> str:
    """Return the canonical digest required by ``JudgingInputV1``."""
    return _digest(conversation)


def _canonical_bytes(value: Any) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()


def _string(value: Mapping[str, Any], field: str) -> str:
    item = value.get(field)
    if not isinstance(item, str) or not item:
        raise JudgmentError(f"{field} must be a non-empty string")
    return item


def _string_or_default(value: Mapping[str, Any], field: str, default: str) -> str:
    item = value.get(field, default)
    if not isinstance(item, str) or not item:
        raise JudgmentError(f"{field} must be a non-empty string")
    return item


def _optional_string(value: Mapping[str, Any], field: str) -> str | None:
    item = value.get(field)
    if item is not None and (not isinstance(item, str) or not item):
        raise JudgmentError(f"{field} must be a non-empty string or null")
    return cast(str | None, item)


def _digest_string(value: Mapping[str, Any], field: str) -> str:
    item = _string(value, field)
    if len(item) != 64 or any(character not in "0123456789abcdef" for character in item):
        raise JudgmentError(f"{field} must be a SHA-256 digest")
    return item


def _integer(value: Mapping[str, Any], field: str) -> int:
    item = value.get(field)
    if type(item) is not int:
        raise JudgmentError(f"{field} must be an integer")
    return item


def _choice(value: Mapping[str, Any], field: str, choices: set[str]) -> str:
    item = _string(value, field)
    if item not in choices:
        raise JudgmentError(f"{field} must be one of {sorted(choices)!r}")
    return item


def _string_tuple(value: Mapping[str, Any], field: str) -> tuple[str, ...]:
    raw = value.get(field)
    if not isinstance(raw, list) or any(not isinstance(item, str) or not item for item in raw):
        raise JudgmentError(f"{field} must be an array of non-empty strings")
    return tuple(raw)


def _seed_intensities(value: Mapping[Any, Any]) -> dict[str, float]:
    result: dict[str, float] = {}
    for key, item in value.items():
        if not isinstance(key, str) or not key:
            raise JudgmentError("seed intensity IDs must be non-empty strings")
        if (
            isinstance(item, bool)
            or not isinstance(item, (int, float))
            or not isfinite(float(item))
        ):
            raise JudgmentError(f"seed intensity for {key!r} must be a finite number")
        result[key] = float(item)
    return result


def _seed_descriptions(value: Mapping[Any, Any]) -> dict[str, str]:
    result: dict[str, str] = {}
    for key, item in value.items():
        if not isinstance(key, str) or not key or not isinstance(item, str) or not item:
            raise JudgmentError("seed descriptions must use non-empty string IDs and text")
        result[key] = item
    return result

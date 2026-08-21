"""Resumable state and cost controls for offline datagen passes."""

from __future__ import annotations

import itertools
import json
import os
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from decimal import Decimal
from hashlib import sha256
from pathlib import Path
from typing import Any, Iterable, Literal, Mapping, Sequence, cast

Lane = Literal["self_play", "scripted"]
ProcessingMode = Literal["direct", "batch"]
BudgetPool = Literal["generation", "judge", "retry"]

DEFAULT_LANE_TARGETS: Mapping[Lane, int] = {"self_play": 3_000, "scripted": 2_000}
LANES: tuple[Lane, Lane] = ("self_play", "scripted")
ATTEMPT_MULTIPLIER = Decimal("1.25")
DEFAULT_BUDGET_USD = Decimal("100")
DEFAULT_BUDGET_SHARES: Mapping[BudgetPool, Decimal] = {
    "generation": Decimal("0.75"),
    "judge": Decimal("0.10"),
    "retry": Decimal("0.15"),
}
BUDGET_POOLS: tuple[BudgetPool, BudgetPool, BudgetPool] = ("generation", "judge", "retry")
FRONTIER_FRACTION = Decimal("0.05")

_JOURNALS = ("attempts.jsonl", "jobs.jsonl", "costs.jsonl", "accepted.jsonl", "rejects.jsonl")
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


class BudgetExceeded(GenerationError):
    def __init__(
        self,
        pool: BudgetPool,
        requested_usd: Decimal,
        available_usd: Decimal,
        total_available_usd: Decimal,
    ) -> None:
        self.pool = pool
        self.requested_usd = requested_usd
        self.available_usd = available_usd
        self.total_available_usd = total_available_usd
        super().__init__(
            f"{pool} budget exhausted: requested ${requested_usd}, "
            f"pool available ${available_usd}, total available ${total_available_usd}"
        )


@dataclass(frozen=True)
class MatrixCell:
    cell_id: str
    lane: Lane
    ordinal: int
    factors: Mapping[str, Any]
    assistant_model: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "cell_id": self.cell_id,
            "lane": self.lane,
            "ordinal": self.ordinal,
            "factors": dict(self.factors),
            "assistant_model": self.assistant_model,
        }


@dataclass(frozen=True)
class RunConfig:
    run_id: str
    matrix_seed: int
    matrix_sha256: str
    luna_model: str
    frontier_model: str
    pricing_version: str
    pricing_sha256: str
    budget_usd: str = "100"
    self_play_target: int = 3_000
    scripted_target: int = 2_000
    generation_share: str = "0.75"
    judge_share: str = "0.10"
    retry_share: str = "0.15"

    def __post_init__(self) -> None:
        if not self.run_id or ":" in self.run_id:
            raise GenerationError("run_id must be non-empty and must not contain ':'")
        if not self.luna_model or not self.frontier_model:
            raise GenerationError("luna_model and frontier_model must be configured explicitly")
        for field, digest in (
            ("matrix_sha256", self.matrix_sha256),
            ("pricing_sha256", self.pricing_sha256),
        ):
            if len(digest) != 64 or any(
                character not in "0123456789abcdef" for character in digest
            ):
                raise GenerationError(f"{field} must be a SHA-256 hex digest")
        if self.self_play_target < 1 or self.scripted_target < 1:
            raise GenerationError("lane targets must be positive")
        shares = sum(
            (
                Decimal(value)
                for value in (self.generation_share, self.judge_share, self.retry_share)
            ),
            Decimal(),
        )
        if shares != Decimal(1):
            raise GenerationError("budget shares must sum to 1")
        if Decimal(self.budget_usd) <= 0:
            raise GenerationError("budget_usd must be positive")

    @property
    def lane_targets(self) -> Mapping[Lane, int]:
        return {"self_play": self.self_play_target, "scripted": self.scripted_target}

    @property
    def lane_attempt_caps(self) -> Mapping[Lane, int]:
        return {
            lane: int(Decimal(target) * ATTEMPT_MULTIPLIER)
            for lane, target in self.lane_targets.items()
        }

    @property
    def budget_shares(self) -> Mapping[BudgetPool, Decimal]:
        return {
            "generation": Decimal(self.generation_share),
            "judge": Decimal(self.judge_share),
            "retry": Decimal(self.retry_share),
        }

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class ModelPrice:
    input_per_million_usd: Decimal
    cached_input_per_million_usd: Decimal
    output_per_million_usd: Decimal
    batch_multiplier: Decimal


class PriceCatalog:
    def __init__(
        self, version: str, models: Mapping[str, ModelPrice], *, sha256_digest: str = ""
    ) -> None:
        self.version = version
        self.sha256 = sha256_digest
        self._models = dict(models)

    @classmethod
    def load(cls, path: Path) -> PriceCatalog:
        try:
            content = path.read_bytes()
            value = json.loads(content)
        except (OSError, json.JSONDecodeError) as error:
            raise GenerationError(f"Unable to read pricing table {path}: {error}") from error
        if not isinstance(value, dict):
            raise GenerationError(f"Expected JSON object in pricing table {path}")
        if value.get("schema_version") != 1 or value.get("token_unit", 1_000_000) != 1_000_000:
            raise GenerationError(f"Unsupported pricing schema in {path}")
        version = value.get("version")
        models = value.get("models")
        if not isinstance(version, str) or not isinstance(models, dict):
            raise GenerationError(f"Invalid pricing table in {path}")
        parsed: dict[str, ModelPrice] = {}
        for model, raw in models.items():
            if not isinstance(model, str) or not isinstance(raw, dict):
                raise GenerationError(f"Invalid model price in {path}")
            try:
                parsed[model] = ModelPrice(
                    input_per_million_usd=Decimal(str(raw["input_per_million_usd"])),
                    cached_input_per_million_usd=Decimal(str(raw["cached_input_per_million_usd"])),
                    output_per_million_usd=Decimal(str(raw["output_per_million_usd"])),
                    batch_multiplier=Decimal(str(raw["batch_multiplier"])),
                )
            except (KeyError, ArithmeticError) as error:
                raise GenerationError(f"Invalid price for model {model!r} in {path}") from error
            price = parsed[model]
            if min(
                price.input_per_million_usd,
                price.cached_input_per_million_usd,
                price.output_per_million_usd,
            ) < 0 or not Decimal() < price.batch_multiplier <= Decimal(1):
                raise GenerationError(f"Invalid price for model {model!r} in {path}")
        return cls(version, parsed, sha256_digest=sha256(content).hexdigest())

    def require(self, model: str) -> ModelPrice:
        try:
            return self._models[model]
        except KeyError as error:
            raise GenerationError(
                f"No configured price for model {model!r}; model substitution is disabled"
            ) from error

    def reserve_cost(
        self,
        model: str,
        *,
        max_input_tokens: int,
        max_output_tokens: int,
        mode: ProcessingMode,
    ) -> Decimal:
        return self._cost(
            model,
            input_tokens=max_input_tokens,
            cached_input_tokens=0,
            output_tokens=max_output_tokens,
            mode=mode,
        )

    def actual_cost(
        self,
        model: str,
        *,
        input_tokens: int,
        cached_input_tokens: int,
        output_tokens: int,
        mode: ProcessingMode,
    ) -> Decimal:
        if cached_input_tokens > input_tokens:
            raise GenerationError("cached_input_tokens cannot exceed input_tokens")
        return self._cost(
            model,
            input_tokens=input_tokens,
            cached_input_tokens=cached_input_tokens,
            output_tokens=output_tokens,
            mode=mode,
        )

    def _cost(
        self,
        model: str,
        *,
        input_tokens: int,
        cached_input_tokens: int,
        output_tokens: int,
        mode: ProcessingMode,
    ) -> Decimal:
        if min(input_tokens, cached_input_tokens, output_tokens) < 0:
            raise GenerationError("token counts cannot be negative")
        price = self.require(model)
        uncached = input_tokens - cached_input_tokens
        cost = (
            Decimal(uncached) * price.input_per_million_usd
            + Decimal(cached_input_tokens) * price.cached_input_per_million_usd
            + Decimal(output_tokens) * price.output_per_million_usd
        ) / Decimal(1_000_000)
        if mode == "batch":
            cost *= price.batch_multiplier
        elif mode != "direct":
            raise GenerationError(f"Unknown processing mode {mode!r}")
        return _money(cost)


@dataclass(frozen=True)
class Attempt:
    attempt_id: str
    cell_id: str
    lane: Lane
    purpose: str
    attempt_number: int
    reservation_id: str
    model: str
    mode: ProcessingMode


@dataclass(frozen=True)
class CostSummary:
    spent_usd: Decimal
    reserved_usd: Decimal
    available_usd: Decimal
    pools: Mapping[BudgetPool, Mapping[str, Decimal]]


def expand_seed_matrix(
    factors: Mapping[str, Sequence[Any]],
    *,
    seed: int,
    luna_model: str,
    frontier_model: str,
    lane_targets: Mapping[Lane, int] = DEFAULT_LANE_TARGETS,
) -> tuple[MatrixCell, ...]:
    """Expand factored values into stable lane cells, cycling when targets exceed the product."""
    if not factors:
        raise GenerationError("matrix factors must not be empty")
    names = sorted(factors)
    values = []
    for name in names:
        choices = factors[name]
        if not isinstance(name, str) or not name or not choices:
            raise GenerationError("matrix factor names and value lists must be non-empty")
        values.append(tuple(choices))
    combinations = tuple(dict(zip(names, items)) for items in itertools.product(*values))
    cells = []
    for lane in LANES:
        target = lane_targets[lane]
        if target < 1:
            raise GenerationError(f"{lane} target must be positive")
        for ordinal in range(target):
            selected = combinations[ordinal % len(combinations)]
            identity = {
                "schema_version": 1,
                "matrix_seed": seed,
                "lane": lane,
                "ordinal": ordinal,
                "factors": selected,
            }
            cell_id = sha256(_canonical_bytes(identity)).hexdigest()
            use_frontier = lane == "self_play" and ordinal % int(1 / FRONTIER_FRACTION) == 0
            cells.append(
                MatrixCell(
                    cell_id=cell_id,
                    lane=lane,
                    ordinal=ordinal,
                    factors=selected,
                    assistant_model=frontier_model if use_frontier else luna_model,
                )
            )
    return tuple(cells)


def matrix_document(cells: Sequence[MatrixCell], seed: int) -> dict[str, Any]:
    return {"schema_version": 1, "matrix_seed": seed, "cells": [cell.to_dict() for cell in cells]}


def matrix_sha256(cells: Sequence[MatrixCell], seed: int) -> str:
    return sha256(_canonical_bytes(matrix_document(cells, seed))).hexdigest()


class GenerationRun:
    def __init__(self, directory: Path, config: RunConfig, cells: Sequence[MatrixCell]) -> None:
        self.directory = directory
        self.config = config
        self.cells = tuple(cells)
        self._cells_by_id = {cell.cell_id: cell for cell in cells}

    @classmethod
    def create_or_resume(
        cls, directory: Path, *, config: RunConfig, cells: Sequence[MatrixCell]
    ) -> GenerationRun:
        document = matrix_document(cells, config.matrix_seed)
        digest = sha256(_canonical_bytes(document)).hexdigest()
        if digest != config.matrix_sha256:
            raise ConfigurationMismatch(
                f"matrix hash differs from run config: {digest} != {config.matrix_sha256}"
            )
        if len({cell.cell_id for cell in cells}) != len(cells):
            raise GenerationError("matrix contains duplicate cell IDs")
        directory.mkdir(parents=True, exist_ok=True)
        _write_immutable_json(directory / "matrix.json", document)
        _write_immutable_json(directory / "run.json", config.to_dict())
        (directory / "staging").mkdir(exist_ok=True)
        for journal in _JOURNALS:
            (directory / journal).touch(exist_ok=True)
        return cls(directory, config, cells)

    @classmethod
    def resume(cls, directory: Path) -> GenerationRun:
        config_value = _load_json(directory / "run.json")
        document = _load_json(directory / "matrix.json")
        config = RunConfig(**config_value)
        if sha256(_canonical_bytes(document)).hexdigest() != config.matrix_sha256:
            raise ConfigurationMismatch("persisted matrix does not match run.json")
        raw_cells = document.get("cells")
        if not isinstance(raw_cells, list):
            raise ConfigurationMismatch("persisted matrix has no cells")
        cells = tuple(
            MatrixCell(
                cell_id=row["cell_id"],
                lane=row["lane"],
                ordinal=row["ordinal"],
                factors=row["factors"],
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
        mode: ProcessingMode,
        max_input_tokens: int,
        max_output_tokens: int,
        prices: PriceCatalog,
    ) -> Attempt:
        cell = self._require_cell(cell_id)
        self._require_prices(prices)
        self._require_no_cost_violation()
        if model not in {self.config.luna_model, self.config.frontier_model}:
            raise ConfigurationMismatch(f"model {model!r} is not configured for this run")
        if cell_id in self.accepted_cell_ids:
            raise AlreadyAccepted(f"cell {cell_id} is already accepted")
        if open_attempt := self._open_attempt(cell_id, purpose):
            self._assert_open_attempt_contract(
                open_attempt,
                model=model,
                mode=mode,
                max_input_tokens=max_input_tokens,
                max_output_tokens=max_output_tokens,
            )
            return open_attempt

        attempts = self._generation_attempts(cell.lane)
        cap = self.config.lane_attempt_caps[cell.lane]
        if purpose == "generation" and attempts >= cap:
            raise AttemptCapExceeded(cell.lane, attempts, cap)
        attempt_number = self._next_attempt_number(cell_id, purpose)
        attempt_id = f"{cell_id}:{purpose}:{attempt_number}"
        reservation_id = f"{attempt_id}:cost"
        pool: BudgetPool = (
            "retry" if attempt_number > 1 else ("judge" if purpose == "judge" else "generation")
        )
        reserved = prices.reserve_cost(
            model,
            max_input_tokens=max_input_tokens,
            max_output_tokens=max_output_tokens,
            mode=mode,
        )
        self._reserve(
            reservation_id,
            attempt_id=attempt_id,
            cell_id=cell_id,
            pool=pool,
            model=model,
            mode=mode,
            amount_usd=reserved,
            max_input_tokens=max_input_tokens,
            max_output_tokens=max_output_tokens,
        )
        event = {
            "event": "started",
            "at": _now(),
            "attempt_id": attempt_id,
            "cell_id": cell_id,
            "lane": cell.lane,
            "purpose": purpose,
            "attempt_number": attempt_number,
            "reservation_id": reservation_id,
            "model": model,
            "mode": mode,
        }
        _append_json(self.directory / "attempts.jsonl", event)
        (self.directory / "staging" / cell_id / f"attempt-{attempt_number}").mkdir(
            parents=True, exist_ok=True
        )
        return _attempt_from_event(event)

    def checkpoint(self, attempt_id: str, checkpoint: Mapping[str, Any]) -> None:
        self._require_open_attempt(attempt_id)
        _append_json(
            self.directory / "attempts.jsonl",
            {"event": "checkpoint", "at": _now(), "attempt_id": attempt_id, "data": checkpoint},
        )

    def complete_attempt(
        self,
        attempt_id: str,
        *,
        prices: PriceCatalog,
        input_tokens: int,
        cached_input_tokens: int,
        output_tokens: int,
    ) -> Decimal:
        attempt = self._require_open_attempt(attempt_id)
        self._require_prices(prices)
        reservation = self._reservation(attempt.reservation_id)
        max_input_tokens = cast(int, reservation["max_input_tokens"])
        max_output_tokens = cast(int, reservation["max_output_tokens"])
        if input_tokens > max_input_tokens or output_tokens > max_output_tokens:
            self._record_cost_invariant_violation(
                attempt.reservation_id,
                reason="reported usage exceeds admitted token envelope",
                input_tokens=input_tokens,
                cached_input_tokens=cached_input_tokens,
                output_tokens=output_tokens,
            )
            raise GenerationError(
                f"reported usage exceeds admitted token envelope for {attempt.reservation_id}: "
                f"input {input_tokens}/{max_input_tokens}, "
                f"output {output_tokens}/{max_output_tokens}"
            )
        actual = prices.actual_cost(
            attempt.model,
            input_tokens=input_tokens,
            cached_input_tokens=cached_input_tokens,
            output_tokens=output_tokens,
            mode=attempt.mode,
        )
        self._reconcile(
            attempt.reservation_id,
            actual_usd=actual,
            input_tokens=input_tokens,
            cached_input_tokens=cached_input_tokens,
            output_tokens=output_tokens,
        )
        _append_json(
            self.directory / "attempts.jsonl",
            {"event": "completed", "at": _now(), "attempt_id": attempt_id},
        )
        return actual

    def fail_attempt(
        self,
        attempt_id: str,
        reason: str,
        *,
        prices: PriceCatalog | None = None,
        input_tokens: int | None = None,
        cached_input_tokens: int | None = None,
        output_tokens: int | None = None,
    ) -> None:
        attempt = self._require_open_attempt(attempt_id)
        usage = (input_tokens, cached_input_tokens, output_tokens)
        if prices is None and all(value is None for value in usage):
            self._reconcile(attempt.reservation_id, actual_usd=Decimal(), error=reason)
        elif prices is None or any(value is None for value in usage):
            raise GenerationError(
                "failed attempt usage requires prices, input_tokens, "
                "cached_input_tokens, and output_tokens"
            )
        else:
            self._require_prices(prices)
            reservation = self._reservation(attempt.reservation_id)
            max_input_tokens = cast(int, reservation["max_input_tokens"])
            max_output_tokens = cast(int, reservation["max_output_tokens"])
            assert input_tokens is not None
            assert cached_input_tokens is not None
            assert output_tokens is not None
            if input_tokens > max_input_tokens or output_tokens > max_output_tokens:
                self._record_cost_invariant_violation(
                    attempt.reservation_id,
                    reason="reported usage exceeds admitted token envelope",
                    input_tokens=input_tokens,
                    cached_input_tokens=cached_input_tokens,
                    output_tokens=output_tokens,
                )
                raise GenerationError(
                    "reported usage exceeds admitted token envelope for "
                    f"{attempt.reservation_id}: input {input_tokens}/{max_input_tokens}, "
                    f"output {output_tokens}/{max_output_tokens}"
                )
            actual = prices.actual_cost(
                attempt.model,
                input_tokens=input_tokens,
                cached_input_tokens=cached_input_tokens,
                output_tokens=output_tokens,
                mode=attempt.mode,
            )
            self._reconcile(
                attempt.reservation_id,
                actual_usd=actual,
                input_tokens=input_tokens,
                cached_input_tokens=cached_input_tokens,
                output_tokens=output_tokens,
                error=reason,
            )
        _append_json(
            self.directory / "attempts.jsonl",
            {"event": "failed", "at": _now(), "attempt_id": attempt_id, "reason": reason},
        )
        _append_json(
            self.directory / "rejects.jsonl",
            {
                "at": _now(),
                "cell_id": attempt.cell_id,
                "attempt_id": attempt_id,
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
        _append_json(
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
        for record in _read_jsonl(self.directory / "accepted.jsonl"):
            cell_id = record["cell_id"]
            if cell_id in records and records[cell_id] != record:
                raise GenerationError(f"accepted journal contains duplicate cell {cell_id}")
            records[cell_id] = record
        return records

    @property
    def accepted_cell_ids(self) -> frozenset[str]:
        return frozenset(self.accepted_records)

    def record_job(self, job: Mapping[str, Any]) -> None:
        if not isinstance(job.get("batch_id"), str) or not job["batch_id"]:
            raise GenerationError("provider job requires batch_id")
        _append_json(self.directory / "jobs.jsonl", {"at": _now(), **job})

    def record_job_result(self, batch_id: str, result: Mapping[str, Any]) -> None:
        custom_identifier = result.get("custom_id")
        if not isinstance(custom_identifier, str) or not custom_identifier:
            raise GenerationError("provider job result requires custom_id")
        matching = [
            event
            for event in _read_jsonl(self.directory / "jobs.jsonl")
            if event.get("event") == "result"
            and event.get("batch_id") == batch_id
            and event.get("custom_id") == custom_identifier
        ]
        comparable = {"event": "result", "batch_id": batch_id, **result}
        if matching:
            if any(
                {key: value for key, value in event.items() if key != "at"} != comparable
                for event in matching
            ):
                raise GenerationError(
                    f"Batch result changed for {batch_id} custom_id {custom_identifier}"
                )
            return
        _append_json(self.directory / "jobs.jsonl", {"at": _now(), **comparable})

    @property
    def latest_jobs(self) -> Mapping[str, Mapping[str, Any]]:
        jobs: dict[str, Mapping[str, Any]] = {}
        for event in _read_jsonl(self.directory / "jobs.jsonl"):
            if event.get("event") != "result":
                jobs[event["batch_id"]] = event
        return jobs

    @property
    def job_results(self) -> Mapping[str, Mapping[str, Any]]:
        results: dict[str, Mapping[str, Any]] = {}
        for event in _read_jsonl(self.directory / "jobs.jsonl"):
            if event.get("event") == "result":
                results[event["custom_id"]] = event
        return results

    def batch_cells_to_submit(self, cell_ids: Iterable[str], *, purpose: str) -> tuple[str, ...]:
        if not purpose or ":" in purpose:
            raise GenerationError("Batch purpose must be non-empty and must not contain ':'")
        latest_by_custom_id = {
            custom_identifier: job
            for job in self.latest_jobs.values()
            for custom_identifier in cast(Sequence[str], job.get("custom_ids", ()))
        }
        results = self.job_results

        def is_active_or_succeeded(cell_id: str) -> bool:
            identifier = f"{self.config.run_id}:{cell_id}:{purpose}"
            job = latest_by_custom_id.get(identifier)
            if job is None or job.get("status") in {"failed", "expired", "cancelled"}:
                return False
            if job.get("status") != "completed":
                return True
            result = results.get(identifier)
            status_code = result.get("response_status_code") if result else None
            return (
                result is not None
                and result.get("error") is None
                and isinstance(status_code, int)
                and 200 <= status_code < 300
            )

        return tuple(
            cell_id
            for cell_id in cell_ids
            if cell_id not in self.accepted_cell_ids and not is_active_or_succeeded(cell_id)
        )

    def cost_summary(self) -> CostSummary:
        reservations: dict[str, Mapping[str, Any]] = {}
        reconciliations: dict[str, Mapping[str, Any]] = {}
        events = _read_jsonl(self.directory / "costs.jsonl")
        blocked = any(event["event"] == "invariant_violation" for event in events)
        for event in events:
            if event["event"] == "reserved":
                reservations[event["reservation_id"]] = event
            elif event["event"] == "reconciled":
                reconciliations[event["reservation_id"]] = event
        spent = sum(
            (Decimal(record["actual_usd"]) for record in reconciliations.values()), Decimal()
        )
        outstanding = {
            key: record for key, record in reservations.items() if key not in reconciliations
        }
        reserved = sum(
            (Decimal(record["amount_usd"]) for record in outstanding.values()), Decimal()
        )
        budget = Decimal(self.config.budget_usd)
        pools: dict[BudgetPool, Mapping[str, Decimal]] = {}
        for pool in BUDGET_POOLS:
            pool_spent = sum(
                (
                    Decimal(record["actual_usd"])
                    for key, record in reconciliations.items()
                    if reservations[key]["pool"] == pool
                ),
                Decimal(),
            )
            pool_reserved = sum(
                (
                    Decimal(record["amount_usd"])
                    for record in outstanding.values()
                    if record["pool"] == pool
                ),
                Decimal(),
            )
            limit = budget * self.config.budget_shares[pool]
            pools[pool] = {
                "limit_usd": _money(limit),
                "spent_usd": _money(pool_spent),
                "reserved_usd": _money(pool_reserved),
                "available_usd": Decimal()
                if blocked
                else _money(limit - pool_spent - pool_reserved),
            }
        return CostSummary(
            spent_usd=_money(spent),
            reserved_usd=_money(reserved),
            available_usd=Decimal() if blocked else _money(budget - spent - reserved),
            pools=pools,
        )

    def status(self) -> Mapping[str, Any]:
        accepted_by_lane = {
            lane: sum(record["lane"] == lane for record in self.accepted_records.values())
            for lane in LANES
        }
        attempts_by_lane = {lane: self._generation_attempts(lane) for lane in LANES}
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
        denials = [
            event
            for event in _read_jsonl(self.directory / "costs.jsonl")
            if event["event"] == "denied"
        ]
        if denials:
            exhausted.append({"kind": "budget", **denials[-1]})
        violations = [
            event
            for event in _read_jsonl(self.directory / "costs.jsonl")
            if event["event"] == "invariant_violation"
        ]
        if violations:
            exhausted.append({"kind": "cost_invariant", **violations[-1]})
        costs = self.cost_summary()
        complete = all(accepted_by_lane[lane] >= self.config.lane_targets[lane] for lane in LANES)
        return {
            "run_id": self.config.run_id,
            "complete": complete,
            "accepted": accepted_by_lane,
            "targets": dict(self.config.lane_targets),
            "attempts": attempts_by_lane,
            "attempt_caps": dict(self.config.lane_attempt_caps),
            "costs": {
                "spent_usd": str(costs.spent_usd),
                "reserved_usd": str(costs.reserved_usd),
                "available_usd": str(costs.available_usd),
                "pools": {
                    pool: {name: str(value) for name, value in values.items()}
                    for pool, values in costs.pools.items()
                },
            },
            "exhausted": exhausted,
        }

    def _reserve(
        self,
        reservation_id: str,
        *,
        attempt_id: str,
        cell_id: str,
        pool: BudgetPool,
        model: str,
        mode: ProcessingMode,
        amount_usd: Decimal,
        max_input_tokens: int,
        max_output_tokens: int,
    ) -> None:
        events = _read_jsonl(self.directory / "costs.jsonl")
        if violation := next(
            (event for event in reversed(events) if event["event"] == "invariant_violation"), None
        ):
            raise GenerationError(
                f"run is blocked by cost invariant violation for {violation['reservation_id']}"
            )
        existing = next(
            (
                event
                for event in events
                if event.get("reservation_id") == reservation_id and event["event"] == "reserved"
            ),
            None,
        )
        expected = {
            "attempt_id": attempt_id,
            "cell_id": cell_id,
            "pool": pool,
            "model": model,
            "mode": mode,
            "amount_usd": str(amount_usd),
            "max_input_tokens": max_input_tokens,
            "max_output_tokens": max_output_tokens,
        }
        if existing:
            if any(existing.get(key) != value for key, value in expected.items()):
                raise GenerationError(f"reservation {reservation_id} changed on resume")
            return
        summary = self.cost_summary()
        pool_available = summary.pools[pool]["available_usd"]
        if amount_usd > pool_available or amount_usd > summary.available_usd:
            denial = {
                "event": "denied",
                "at": _now(),
                "reservation_id": reservation_id,
                "pool": pool,
                "requested_usd": str(amount_usd),
                "pool_available_usd": str(pool_available),
                "total_available_usd": str(summary.available_usd),
            }
            _append_json(self.directory / "costs.jsonl", denial)
            raise BudgetExceeded(pool, amount_usd, pool_available, summary.available_usd)
        _append_json(
            self.directory / "costs.jsonl",
            {"event": "reserved", "at": _now(), "reservation_id": reservation_id, **expected},
        )

    def _reconcile(
        self,
        reservation_id: str,
        *,
        actual_usd: Decimal,
        input_tokens: int = 0,
        cached_input_tokens: int = 0,
        output_tokens: int = 0,
        error: str | None = None,
    ) -> None:
        events = _read_jsonl(self.directory / "costs.jsonl")
        reservation = next(
            (
                event
                for event in events
                if event.get("reservation_id") == reservation_id and event["event"] == "reserved"
            ),
            None,
        )
        if reservation is None:
            raise GenerationError(f"unknown reservation {reservation_id}")
        existing = next(
            (
                event
                for event in events
                if event.get("reservation_id") == reservation_id and event["event"] == "reconciled"
            ),
            None,
        )
        if existing:
            if Decimal(existing["actual_usd"]) != actual_usd:
                raise GenerationError(f"reservation {reservation_id} was already reconciled")
            return
        reserved = Decimal(reservation["amount_usd"])
        if actual_usd > reserved:
            self._record_cost_invariant_violation(
                reservation_id,
                reason="actual cost exceeds worst-case reservation",
                actual_usd=actual_usd,
            )
            raise GenerationError(
                f"actual cost ${actual_usd} exceeds reservation ${reserved} for {reservation_id}"
            )
        _append_json(
            self.directory / "costs.jsonl",
            {
                "event": "reconciled",
                "at": _now(),
                "reservation_id": reservation_id,
                "reserved_usd": str(reserved),
                "actual_usd": str(actual_usd),
                "released_usd": str(_money(reserved - actual_usd)),
                "input_tokens": input_tokens,
                "cached_input_tokens": cached_input_tokens,
                "output_tokens": output_tokens,
                **({"error": error} if error else {}),
            },
        )

    def _require_cell(self, cell_id: str) -> MatrixCell:
        try:
            return self._cells_by_id[cell_id]
        except KeyError as error:
            raise GenerationError(f"unknown matrix cell {cell_id}") from error

    def _require_prices(self, prices: PriceCatalog) -> None:
        if (
            prices.version != self.config.pricing_version
            or prices.sha256 != self.config.pricing_sha256
        ):
            raise ConfigurationMismatch("pricing table differs from the immutable run config")

    def _require_no_cost_violation(self) -> None:
        violation = next(
            (
                event
                for event in reversed(_read_jsonl(self.directory / "costs.jsonl"))
                if event["event"] == "invariant_violation"
            ),
            None,
        )
        if violation:
            raise GenerationError(
                f"run is blocked by cost invariant violation for {violation['reservation_id']}"
            )

    def _reservation(self, reservation_id: str) -> Mapping[str, Any]:
        reservation = next(
            (
                event
                for event in _read_jsonl(self.directory / "costs.jsonl")
                if event.get("reservation_id") == reservation_id and event["event"] == "reserved"
            ),
            None,
        )
        if reservation is None:
            raise GenerationError(f"unknown reservation {reservation_id}")
        return reservation

    def _assert_open_attempt_contract(
        self,
        attempt: Attempt,
        *,
        model: str,
        mode: ProcessingMode,
        max_input_tokens: int,
        max_output_tokens: int,
    ) -> None:
        reservation = self._reservation(attempt.reservation_id)
        requested = {
            "model": model,
            "mode": mode,
            "max_input_tokens": max_input_tokens,
            "max_output_tokens": max_output_tokens,
        }
        if any(reservation.get(key) != value for key, value in requested.items()):
            raise ConfigurationMismatch(
                f"open attempt {attempt.attempt_id} admission inputs changed on resume"
            )

    def _record_cost_invariant_violation(
        self,
        reservation_id: str,
        *,
        reason: str,
        input_tokens: int = 0,
        cached_input_tokens: int = 0,
        output_tokens: int = 0,
        actual_usd: Decimal | None = None,
    ) -> None:
        expected = {
            "event": "invariant_violation",
            "reservation_id": reservation_id,
            "reason": reason,
            "input_tokens": input_tokens,
            "cached_input_tokens": cached_input_tokens,
            "output_tokens": output_tokens,
            "actual_usd": str(actual_usd) if actual_usd is not None else None,
        }
        matches = [
            event
            for event in _read_jsonl(self.directory / "costs.jsonl")
            if event.get("event") == "invariant_violation"
            and event.get("reservation_id") == reservation_id
        ]
        if matches:
            if any(
                {key: value for key, value in event.items() if key != "at"} != expected
                for event in matches
            ):
                raise GenerationError(
                    f"cost invariant violation changed for reservation {reservation_id}"
                )
            return
        _append_json(self.directory / "costs.jsonl", {"at": _now(), **expected})

    def _attempt_states(self) -> Mapping[str, Mapping[str, Any]]:
        states: dict[str, dict[str, Any]] = {}
        for event in _read_jsonl(self.directory / "attempts.jsonl"):
            attempt_id = event["attempt_id"]
            if event["event"] == "started":
                attempt = _attempt_from_event(event)
                states[attempt_id] = {"event": "started", "attempt": attempt, "latest": event}
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


def _write_immutable_json(path: Path, value: Mapping[str, Any]) -> None:
    content = _canonical_bytes(value) + b"\n"
    if path.exists():
        if path.read_bytes() != content:
            raise ConfigurationMismatch(f"immutable run file differs: {path}")
        return
    try:
        descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o644)
    except FileExistsError:
        if path.read_bytes() != content:
            raise ConfigurationMismatch(f"immutable run file differs: {path}")
        return
    with os.fdopen(descriptor, "wb") as output:
        output.write(content)
        output.flush()
        os.fsync(output.fileno())


def _append_json(path: Path, value: Mapping[str, Any]) -> None:
    with path.open("a", encoding="utf-8") as output:
        output.write(_canonical_bytes(value).decode() + "\n")
        output.flush()
        os.fsync(output.fileno())


def _read_jsonl(path: Path) -> list[Mapping[str, Any]]:
    if not path.exists():
        return []
    records: list[Mapping[str, Any]] = []
    for line_number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        if not line:
            continue
        try:
            value = json.loads(line)
        except json.JSONDecodeError as error:
            raise GenerationError(
                f"Invalid JSON in {path} at line {line_number}: {error}"
            ) from error
        if not isinstance(value, dict):
            raise GenerationError(f"Expected object in {path} at line {line_number}")
        records.append(value)
    return records


def _load_json(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise GenerationError(f"Unable to read {path}: {error}") from error
    if not isinstance(value, dict):
        raise GenerationError(f"Expected JSON object in {path}")
    return value


def _canonical_bytes(value: Any) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()


def _money(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.000000001"))


def _now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _attempt_from_event(event: Mapping[str, Any]) -> Attempt:
    return Attempt(
        attempt_id=cast(str, event["attempt_id"]),
        cell_id=cast(str, event["cell_id"]),
        lane=cast(Lane, event["lane"]),
        purpose=cast(str, event["purpose"]),
        attempt_number=cast(int, event["attempt_number"]),
        reservation_id=cast(str, event["reservation_id"]),
        model=cast(str, event["model"]),
        mode=cast(ProcessingMode, event["mode"]),
    )

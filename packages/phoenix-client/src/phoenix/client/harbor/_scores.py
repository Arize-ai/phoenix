# pyright: reportMissingImports=false, reportMissingTypeStubs=false
# pyright: reportUnknownVariableType=false, reportUnknownMemberType=false
# pyright: reportUnknownArgumentType=false, reportUnknownParameterType=false
"""Extract Phoenix evaluation records from terminal Harbor trial results."""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

from harbor.models.trial.result import ExceptionInfo, TimingInfo, TrialResult

logger = logging.getLogger(__name__)

__all__ = ["EvaluationRecord", "extract_evaluations"]


@dataclass(frozen=True)
class EvaluationRecord:
    name: str
    score: float
    start_time: datetime
    end_time: datetime
    label: str | None = None
    explanation: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


def extract_evaluations(trial_result: TrialResult) -> tuple[EvaluationRecord, ...]:
    """Return the complete evaluation set for one terminal Harbor trial."""
    fallback_time = _fallback_time(trial_result)
    trial_id = str(trial_result.id)
    metadata = {"harbor_trial_id": trial_id}
    records: list[EvaluationRecord] = []
    origins: dict[str, str] = {}

    verifier_result = trial_result.verifier_result
    rewards = verifier_result.rewards if verifier_result is not None else None
    consumed_key: str | None = None
    if rewards:
        if "reward" in rewards:
            consumed_key = "reward"
        elif len(rewards) == 1:
            consumed_key = next(iter(rewards))
        else:
            logger.warning(
                "Harbor trial %r for task %r returned multiple verifier rewards without an "
                "aggregate `reward`; recording sparse scores only. Keys: %s.",
                str(trial_result.trial_name),
                str(trial_result.task_name),
                ", ".join(sorted(rewards)),
            )

        if consumed_key is not None:
            start_time, end_time = _evaluation_times(trial_result.verifier, fallback_time)
            explanation = None
            if consumed_key != "reward":
                explanation = f"Derived from the sole trial-level verifier reward {consumed_key!r}."
            _append_unique(
                records,
                origins,
                EvaluationRecord(
                    name="reward",
                    score=float(rewards[consumed_key]),
                    start_time=start_time,
                    end_time=end_time,
                    explanation=explanation,
                    metadata={**metadata, "source_key": consumed_key},
                ),
                origin=f"trial-level verifier reward {consumed_key!r}",
            )

    failures = _infrastructure_failures(trial_result)
    _append_unique(
        records,
        origins,
        EvaluationRecord(
            name="infra_ok",
            score=0.0 if failures else 1.0,
            start_time=trial_result.started_at or fallback_time,
            end_time=trial_result.finished_at or fallback_time,
            label="infra_failure" if failures else "ok",
            explanation="; ".join(failures) or None,
            metadata=metadata.copy(),
        ),
        origin="infrastructure status",
    )

    if rewards:
        start_time, end_time = _evaluation_times(trial_result.verifier, fallback_time)
        for key in sorted(rewards):
            if key == consumed_key:
                continue
            _append_unique(
                records,
                origins,
                EvaluationRecord(
                    name=f"verifier.{key}",
                    score=float(rewards[key]),
                    start_time=start_time,
                    end_time=end_time,
                    metadata=metadata.copy(),
                ),
                origin=f"trial-level verifier reward {key!r}",
            )

    for step_result in trial_result.step_results or ():
        step_verifier = step_result.verifier_result
        step_rewards = step_verifier.rewards if step_verifier is not None else None
        if not step_rewards:
            continue
        start_time, end_time = _evaluation_times(step_result.verifier, fallback_time)
        for key in sorted(step_rewards):
            _append_unique(
                records,
                origins,
                EvaluationRecord(
                    name=f"{step_result.step_name}.{key}",
                    score=float(step_rewards[key]),
                    start_time=start_time,
                    end_time=end_time,
                    metadata=metadata.copy(),
                ),
                origin=f"step {step_result.step_name!r} reward {key!r}",
            )

    return tuple(records)


def _fallback_time(trial_result: TrialResult) -> datetime:
    fallback: datetime | None = trial_result.finished_at or trial_result.started_at
    if fallback is None:
        raise ValueError(
            f"Harbor trial {trial_result.trial_name!r} has no timestamp for evaluations."
        )
    return fallback


def _evaluation_times(timing: TimingInfo | None, fallback: datetime) -> tuple[datetime, datetime]:
    if timing is None:
        return fallback, fallback
    return timing.started_at or timing.finished_at or fallback, timing.finished_at or fallback


def _infrastructure_failures(trial_result: TrialResult) -> list[str]:
    failures: list[str] = []
    if trial_result.exception_info is not None:
        failures.append(_format_exception("trial", trial_result.exception_info))
    for step_result in trial_result.step_results or ():
        if step_result.exception_info is not None:
            failures.append(
                _format_exception(str(step_result.step_name), step_result.exception_info)
            )
    return failures


def _format_exception(where: str, exception: ExceptionInfo) -> str:
    return f"{where}: {exception.exception_type}: {exception.exception_message}"


def _append_unique(
    records: list[EvaluationRecord],
    origins: dict[str, str],
    record: EvaluationRecord,
    *,
    origin: str,
) -> None:
    if previous := origins.get(record.name):
        raise ValueError(
            f"Harbor evaluation name {record.name!r} is produced by both {previous} and {origin}."
        )
    origins[record.name] = origin
    records.append(record)

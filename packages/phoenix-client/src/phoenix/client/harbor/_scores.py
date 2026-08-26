# pyright: reportMissingImports=false, reportMissingTypeStubs=false
# pyright: reportUnknownVariableType=false, reportUnknownMemberType=false
# pyright: reportUnknownArgumentType=false, reportUnknownParameterType=false
"""Extract Phoenix evaluation records from terminal Harbor trial results."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Literal

from harbor.models.trial.result import ExceptionInfo, TimingInfo, TrialResult

from phoenix.client.harbor._errors import HarborPluginError

__all__ = ["ExtractedEvaluation", "extract_evaluations"]


@dataclass(frozen=True)
class ExtractedEvaluation:
    """Evaluation data extracted before a Phoenix experiment run ID is available."""

    name: str
    score: float
    start_time: datetime
    end_time: datetime
    label: str | None = None
    explanation: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


def extract_evaluations(
    trial_result: TrialResult,
    *,
    multi_step_reward_strategy: Literal["mean", "final"] | None = None,
) -> tuple[ExtractedEvaluation, ...]:
    """Return the complete evaluation set for one terminal Harbor trial."""
    fallback_time = _fallback_time(trial_result)
    metadata = {"harbor_trial_id": str(trial_result.id)}
    records: list[ExtractedEvaluation] = []
    origins: dict[str, str] = {}

    verifier_result = trial_result.verifier_result
    rewards = verifier_result.rewards if verifier_result is not None else None
    if rewards:
        # Harbor sets TrialResult.verifier only for single-step trials. Multi-step
        # trials always use the fallback, so these evaluations get zero duration.
        start_time, end_time = _evaluation_times(trial_result.verifier, fallback_time)
        reward_metadata = metadata.copy()
        if multi_step_reward_strategy is not None:
            reward_metadata["multi_step_reward_strategy"] = multi_step_reward_strategy
        for key in sorted(rewards):
            origin = f"trial-level verifier reward {key!r}"
            record = ExtractedEvaluation(
                name=key,
                score=float(rewards[key]),
                start_time=start_time,
                end_time=end_time,
                metadata=reward_metadata.copy(),
            )
            _append_unique(records, origins, record, origin=origin)

    failures = _infrastructure_failures(trial_result)
    _append_unique(
        records,
        origins,
        ExtractedEvaluation(
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
                ExtractedEvaluation(
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
        raise HarborPluginError(
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
    records: list[ExtractedEvaluation],
    origins: dict[str, str],
    record: ExtractedEvaluation,
    *,
    origin: str,
) -> None:
    if previous := origins.get(record.name):
        raise HarborPluginError(
            f"Harbor evaluation name {record.name!r} is produced by both {previous} and {origin}."
        )
    origins[record.name] = origin
    records.append(record)

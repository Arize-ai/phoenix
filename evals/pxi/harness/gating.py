"""Gating decisions for the PXI eval harness.

The CI contract is intentionally narrower than the report contract: a red
check means a regression example produced an assessable evaluator failure twice.
Task/runtime errors are infrastructure unless a clean evaluator failure is
reproduced on both attempts.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Literal, Mapping, Sequence

from evals.pxi.harness.datasets import EvalDataset
from phoenix.client.resources.experiments.types import ExperimentEvaluationRun, RanExperiment

PASSING_SCORE = 1.0
RETRY_FAILED_CAP = 15

TaskErrorKind = Literal["none", "infra"]
GateStatus = Literal["passed", "failed", "infra"]


def task_run_error(task_run: Mapping[str, Any]) -> str | None:
    output = task_run.get("output")
    output_error = output.get("error") if isinstance(output, dict) else None
    error = task_run.get("error") or output_error
    return str(error) if error else None


def classify_task_error(task_run: Mapping[str, Any]) -> TaskErrorKind:
    """Classify task errors for gating.

    Unknown task errors still mean the example was not assessable. Treat them
    as infra, not regression evidence.
    """
    return "infra" if task_run_error(task_run) else "none"


def score(evaluation_run: ExperimentEvaluationRun) -> float | None:
    result = evaluation_run.result
    if not isinstance(result, dict):
        return None
    value = result.get("score")
    return float(value) if isinstance(value, (int, float)) else None


def is_failed_evaluation(evaluation_run: ExperimentEvaluationRun) -> bool:
    run_score = score(evaluation_run)
    return evaluation_run.error is not None or run_score is None or run_score < PASSING_SCORE


def example_splits_by_id(dataset: EvalDataset) -> dict[str, set[str]]:
    return {
        str(example["id"]): {str(split) for split in example["splits"]}
        for example in dataset.examples
    }


def stable_example_id(task_run: Mapping[str, Any]) -> str:
    output = task_run.get("output")
    if isinstance(output, dict) and isinstance(output.get("stable_example_id"), str):
        return str(output["stable_example_id"])
    return str(task_run.get("dataset_example_id", ""))


@dataclass(frozen=True)
class AttemptOutcome:
    example_id: str
    attempt: int
    task_error: str | None
    failed_evaluators: tuple[str, ...]
    experiment_id: str | None

    @property
    def failed(self) -> bool:
        return self.task_error is not None or bool(self.failed_evaluators)

    @property
    def assessable_regression_failure(self) -> bool:
        return self.task_error is None and bool(self.failed_evaluators)

    @property
    def infra_failure(self) -> bool:
        return self.task_error is not None


@dataclass(frozen=True)
class GateDecision:
    status: GateStatus
    failed_once_ids: tuple[str, ...]
    retry_ids: tuple[str, ...]
    confirmed_regression_ids: tuple[str, ...]
    infra_ids: tuple[str, ...]
    flaky_ids: tuple[str, ...]
    retry_skipped_reason: str | None = None

    @property
    def has_confirmed_regressions(self) -> bool:
        return bool(self.confirmed_regression_ids)

    @property
    def has_infra_failures(self) -> bool:
        return bool(self.infra_ids)


def attempt_outcomes(
    dataset: EvalDataset,
    experiment: RanExperiment,
    *,
    attempt: int,
    gate_splits: Sequence[str] = ("regression",),
) -> dict[str, AttemptOutcome]:
    gated_splits = set(gate_splits)
    splits_by_id = example_splits_by_id(dataset)
    task_runs_by_id = {
        str(task_run["id"]): task_run
        for task_run in experiment.get("task_runs", [])
        if "id" in task_run
    }
    failed_evaluators_by_run_id: dict[str, list[str]] = {}
    for evaluation_run in experiment.get("evaluation_runs") or []:
        if not is_failed_evaluation(evaluation_run):
            continue
        failed_evaluators_by_run_id.setdefault(str(evaluation_run.experiment_run_id), []).append(
            str(evaluation_run.name or "unknown")
        )

    outcomes: dict[str, AttemptOutcome] = {}
    for task_run in task_runs_by_id.values():
        example_id = stable_example_id(task_run)
        if not (splits_by_id.get(example_id, set()) & gated_splits):
            continue
        outcomes[example_id] = AttemptOutcome(
            example_id=example_id,
            attempt=attempt,
            task_error=task_run_error(task_run),
            failed_evaluators=tuple(failed_evaluators_by_run_id.get(str(task_run["id"]), ())),
            experiment_id=str(experiment.get("experiment_id") or "") or None,
        )
    return outcomes


def decide_gate(
    first_attempts: Mapping[str, AttemptOutcome],
    *,
    retry_attempts: Mapping[str, AttemptOutcome] | None = None,
    retry_enabled: bool,
    retry_cap: int = RETRY_FAILED_CAP,
) -> GateDecision:
    failed_once_ids = tuple(
        sorted(id_ for id_, outcome in first_attempts.items() if outcome.failed)
    )
    if not failed_once_ids:
        return GateDecision(
            status="passed",
            failed_once_ids=(),
            retry_ids=(),
            confirmed_regression_ids=(),
            infra_ids=(),
            flaky_ids=(),
        )

    first_infra_ids = {id_ for id_, outcome in first_attempts.items() if outcome.infra_failure}
    first_regression_ids = {
        id_ for id_, outcome in first_attempts.items() if outcome.assessable_regression_failure
    }
    if not retry_enabled:
        return GateDecision(
            status="infra" if first_infra_ids and not first_regression_ids else "failed",
            failed_once_ids=failed_once_ids,
            retry_ids=(),
            confirmed_regression_ids=tuple(sorted(first_regression_ids)),
            infra_ids=tuple(sorted(first_infra_ids)),
            flaky_ids=(),
            retry_skipped_reason="retry disabled",
        )

    if len(failed_once_ids) > retry_cap:
        status: GateStatus = "failed" if first_regression_ids else "infra"
        return GateDecision(
            status=status,
            failed_once_ids=failed_once_ids,
            retry_ids=(),
            confirmed_regression_ids=tuple(sorted(first_regression_ids)),
            infra_ids=tuple(sorted(first_infra_ids)),
            flaky_ids=(),
            retry_skipped_reason=f"retry skipped because {len(failed_once_ids)} failures exceed cap {retry_cap}",
        )

    confirmed_regression_ids: set[str] = set()
    infra_ids: set[str] = set()
    flaky_ids: set[str] = set()
    for example_id in failed_once_ids:
        first = first_attempts[example_id]
        retry = retry_attempts.get(example_id)
        if retry is None:
            infra_ids.add(example_id)
            continue
        if not retry.failed:
            flaky_ids.add(example_id)
            continue
        if first.assessable_regression_failure and retry.assessable_regression_failure:
            confirmed_regression_ids.add(example_id)
            continue
        infra_ids.add(example_id)

    status = "failed" if confirmed_regression_ids else "infra" if infra_ids else "passed"
    return GateDecision(
        status=status,
        failed_once_ids=failed_once_ids,
        retry_ids=failed_once_ids,
        confirmed_regression_ids=tuple(sorted(confirmed_regression_ids)),
        infra_ids=tuple(sorted(infra_ids)),
        flaky_ids=tuple(sorted(flaky_ids)),
    )


def retry_ids_for(
    first_attempts: Mapping[str, AttemptOutcome],
    *,
    retry_cap: int = RETRY_FAILED_CAP,
) -> tuple[str, ...]:
    """Return the IDs of failed first-attempt examples to retry.

    Returns an empty tuple when no examples failed or when the failure count
    exceeds *retry_cap* (too many to be a useful confirmation pass — the caller
    should still invoke :func:`decide_gate` so the cap-exceeded reason is
    captured in the :class:`GateDecision`).
    """
    failed = tuple(sorted(id_ for id_, o in first_attempts.items() if o.failed))
    return () if not failed or len(failed) > retry_cap else failed

"""Unit tests for PXI eval gating decisions."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from phoenix.client.resources.experiments.types import ExperimentEvaluationRun, RanExperiment

from evals.pxi.harness.datasets import EvalDataset
from evals.pxi.harness.gating import (
    attempt_outcomes,
    classify_task_error,
    decide_gate,
)

NOW = datetime.now(timezone.utc)


def _dataset() -> EvalDataset:
    return EvalDataset.model_validate(
        {
            "dataset_name": "example_suite",
            "evaluators": ["correct_tools_called"],
            "examples": [
                {
                    "id": "regression-example",
                    "splits": ["regression"],
                    "input": {"query": "x"},
                    "expected": {"tools": {"required": []}},
                },
                {
                    "id": "another-regression-example",
                    "splits": ["regression"],
                    "input": {"query": "z"},
                    "expected": {"tools": {"required": []}},
                },
                {
                    "id": "dev-example",
                    "splits": ["dev"],
                    "input": {"query": "y"},
                    "expected": {"tools": {"required": []}},
                },
            ],
        }
    )


def _task_run(
    run_id: str,
    example_id: str,
    *,
    error: str | None = None,
    output: Any | None = None,
) -> dict[str, Any]:
    task_run = {
        "id": run_id,
        "dataset_example_id": example_id,
        "output": output if output is not None else {},
        "repetition_number": 1,
        "start_time": NOW.isoformat(),
        "end_time": NOW.isoformat(),
        "experiment_id": "experiment-1",
    }
    if error is not None:
        task_run["error"] = error
    return task_run


def _evaluation(run_id: str, *, score: float | None = 1.0) -> ExperimentEvaluationRun:
    result = {} if score is None else {"score": score}
    return ExperimentEvaluationRun(
        experiment_run_id=run_id,
        start_time=NOW,
        end_time=NOW,
        name="correct_tools_called",
        annotator_kind="CODE",
        result=result,
    )


def _experiment(
    task_runs: list[dict[str, Any]],
    evaluation_runs: list[ExperimentEvaluationRun],
    *,
    experiment_id: str = "experiment-1",
) -> RanExperiment:
    return {
        "experiment_id": experiment_id,
        "dataset_id": "dataset-1",
        "dataset_version_id": "dataset-version-1",
        "task_runs": task_runs,
        "evaluation_runs": evaluation_runs,
        "experiment_metadata": {},
        "project_name": None,
    }


def test_classify_task_error_treats_unknown_errors_as_infra() -> None:
    assert classify_task_error(_task_run("run-1", "regression-example")) == "none"
    assert (
        classify_task_error(
            _task_run("run-1", "regression-example", error="RuntimeError: something odd")
        )
        == "infra"
    )


def test_gate_passes_when_no_regression_examples_fail() -> None:
    experiment = _experiment(
        [
            _task_run("run-1", "regression-example"),
            _task_run("run-2", "dev-example"),
        ],
        [
            _evaluation("run-1", score=1.0),
            _evaluation("run-2", score=0.0),
        ],
    )

    decision = decide_gate(
        attempt_outcomes(_dataset(), experiment, attempt=1),
        retry_enabled=True,
    )

    assert decision.status == "passed"
    assert decision.failed_once_ids == ()


def test_gate_confirms_regression_only_after_retry_failure() -> None:
    dataset = _dataset()
    first = _experiment(
        [_task_run("run-1", "regression-example")],
        [_evaluation("run-1", score=0.0)],
        experiment_id="experiment-1",
    )
    retry = _experiment(
        [_task_run("retry-run-1", "regression-example")],
        [_evaluation("retry-run-1", score=0.0)],
        experiment_id="experiment-2",
    )

    decision = decide_gate(
        attempt_outcomes(dataset, first, attempt=1),
        retry_attempts=attempt_outcomes(dataset, retry, attempt=2),
        retry_enabled=True,
    )

    assert decision.status == "failed"
    assert decision.confirmed_regression_ids == ("regression-example",)
    assert decision.infra_ids == ()


def test_gate_records_flaky_pass_when_retry_passes() -> None:
    dataset = _dataset()
    first = _experiment(
        [_task_run("run-1", "regression-example")],
        [_evaluation("run-1", score=0.0)],
    )
    retry = _experiment(
        [_task_run("retry-run-1", "regression-example")],
        [_evaluation("retry-run-1", score=1.0)],
        experiment_id="experiment-2",
    )

    decision = decide_gate(
        attempt_outcomes(dataset, first, attempt=1),
        retry_attempts=attempt_outcomes(dataset, retry, attempt=2),
        retry_enabled=True,
    )

    assert decision.status == "passed"
    assert decision.flaky_ids == ("regression-example",)


def test_gate_treats_persistent_task_error_as_infra() -> None:
    dataset = _dataset()
    first = _experiment(
        [_task_run("run-1", "regression-example", error="HTTP 520 from model provider")],
        [],
    )
    retry = _experiment(
        [_task_run("retry-run-1", "regression-example", error="TimeoutError: task timed out")],
        [],
        experiment_id="experiment-2",
    )

    decision = decide_gate(
        attempt_outcomes(dataset, first, attempt=1),
        retry_attempts=attempt_outcomes(dataset, retry, attempt=2),
        retry_enabled=True,
    )

    assert decision.status == "infra"
    assert decision.infra_ids == ("regression-example",)
    assert decision.confirmed_regression_ids == ()


def test_gate_treats_eval_failure_then_task_error_as_infra() -> None:
    dataset = _dataset()
    first = _experiment(
        [_task_run("run-1", "regression-example")],
        [_evaluation("run-1", score=0.0)],
    )
    retry = _experiment(
        [_task_run("retry-run-1", "regression-example", error="HTTP 429")],
        [],
        experiment_id="experiment-2",
    )

    decision = decide_gate(
        attempt_outcomes(dataset, first, attempt=1),
        retry_attempts=attempt_outcomes(dataset, retry, attempt=2),
        retry_enabled=True,
    )

    assert decision.status == "infra"
    assert decision.infra_ids == ("regression-example",)


def test_gate_skips_retry_when_over_cap() -> None:
    dataset = _dataset()
    first = _experiment(
        [
            _task_run("run-1", "regression-example"),
            _task_run("run-2", "another-regression-example"),
        ],
        [
            _evaluation("run-1", score=0.0),
            _evaluation("run-2", score=0.0),
        ],
    )

    decision = decide_gate(
        attempt_outcomes(dataset, first, attempt=1),
        retry_enabled=True,
        retry_cap=1,
    )

    assert decision.status == "failed"
    assert decision.retry_ids == ()
    assert decision.retry_skipped_reason == "retry skipped because 2 failures exceed cap 1"

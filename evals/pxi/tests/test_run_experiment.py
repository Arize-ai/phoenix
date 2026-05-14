"""Unit tests for the standalone PXI eval experiment runner.

Run directly:

    uv run pytest evals/pxi/harness/test_run_experiment.py
"""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

import pytest
from phoenix.client.resources.experiments.types import ExperimentEvaluationRun, RanExperiment

from evals.pxi.harness.datasets import EvalDataset
from evals.pxi.harness.run_experiment import (
    ExperimentConfig,
    _failed_evaluation_rows,
    _format_table,
    _has_regression_evaluator_failure,
    _summary_payload,
    _task_error_rows,
    _write_summary_files,
    main,
)


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
                    "id": "dev-example",
                    "splits": ["dev"],
                    "input": {"query": "y"},
                    "expected": {"tools": {"required": []}},
                },
            ],
        }
    )


def _ran_experiment(
    *, dataset_id: str = "dataset-1", experiment_id: str = "experiment-1"
) -> RanExperiment:
    return {
        "experiment_id": experiment_id,
        "dataset_id": dataset_id,
        "dataset_version_id": "dataset-version-1",
        "task_runs": [],
        "evaluation_runs": [],
        "experiment_metadata": {},
        "project_name": None,
    }


def test_format_table_aligns_headers_and_rows() -> None:
    table = _format_table(
        ("Evaluator", "Passed", "Failed"),
        [("correct_tools_called", "10", "0"), ("tool_call_args_match", "9", "1")],
    )
    assert table == "\n".join(
        [
            "+----------------------+--------+--------+",
            "| Evaluator            | Passed | Failed |",
            "+----------------------+--------+--------+",
            "| correct_tools_called | 10     | 0      |",
            "| tool_call_args_match | 9      | 1      |",
            "+----------------------+--------+--------+",
        ]
    )


def test_failed_evaluation_rows_include_stable_example_id_and_details() -> None:
    now = datetime.now(timezone.utc)
    experiment = _ran_experiment()
    experiment["task_runs"] = [
        {
            "id": "run-1",
            "dataset_example_id": "example-1",
            "output": {},
            "repetition_number": 1,
            "start_time": now.isoformat(),
            "end_time": now.isoformat(),
            "experiment_id": "experiment-1",
        }
    ]
    evaluation_run = ExperimentEvaluationRun(
        experiment_run_id="run-1",
        start_time=now,
        end_time=now,
        name="tool_call_args_match",
        annotator_kind="CODE",
        result={"score": 0.0, "label": "fail", "explanation": "wrong filter"},
    )

    assert _failed_evaluation_rows(experiment, [evaluation_run]) == [
        ("example-1", "tool_call_args_match", "0", "fail", "wrong filter")
    ]


def test_task_error_rows_include_output_errors_with_stable_example_id() -> None:
    now = datetime.now(timezone.utc)
    experiment = _ran_experiment()
    experiment["task_runs"] = [
        {
            "id": "run-1",
            "dataset_example_id": "opaque-example-id",
            "output": {
                "stable_example_id": "example-1",
                "error": "RuntimeError: model credentials missing",
            },
            "repetition_number": 1,
            "start_time": now.isoformat(),
            "end_time": now.isoformat(),
            "experiment_id": "experiment-1",
        }
    ]

    assert _task_error_rows(experiment) == [
        ("example-1", "RuntimeError: model credentials missing")
    ]


def test_task_error_rows_include_task_run_errors() -> None:
    now = datetime.now(timezone.utc)
    experiment = _ran_experiment()
    experiment["task_runs"] = [
        {
            "id": "run-1",
            "dataset_example_id": "example-1",
            "output": {},
            "repetition_number": 1,
            "start_time": now.isoformat(),
            "end_time": now.isoformat(),
            "experiment_id": "experiment-1",
            "error": "TimeoutError: task timed out",
        }
    ]

    assert _task_error_rows(experiment) == [("example-1", "TimeoutError: task timed out")]


def test_main_defaults_to_regression_split(monkeypatch: pytest.MonkeyPatch) -> None:
    captured: list[ExperimentConfig] = []

    def fake_run(config: ExperimentConfig) -> int:
        captured.append(config)
        return 0

    monkeypatch.setattr("evals.pxi.harness.run_experiment.run", fake_run)

    assert main(["--dataset", "set_spans_filter"]) == 0
    assert captured[0].splits == ("regression",)


def test_main_forwards_explicit_splits(monkeypatch: pytest.MonkeyPatch) -> None:
    captured: list[ExperimentConfig] = []

    def fake_run(config: ExperimentConfig) -> int:
        captured.append(config)
        return 0

    monkeypatch.setattr("evals.pxi.harness.run_experiment.run", fake_run)

    assert main(["--dataset", "set_spans_filter", "--splits", "dev", "val"]) == 0
    assert captured[0].splits == ("dev", "val")


def test_fail_on_regression_detects_only_regression_failures() -> None:
    now = datetime.now(timezone.utc)
    experiment = _ran_experiment()
    experiment["task_runs"] = [
        {
            "id": "run-1",
            "dataset_example_id": "regression-example",
            "output": {},
            "repetition_number": 1,
            "start_time": now.isoformat(),
            "end_time": now.isoformat(),
            "experiment_id": "experiment-1",
        },
        {
            "id": "run-2",
            "dataset_example_id": "dev-example",
            "output": {},
            "repetition_number": 1,
            "start_time": now.isoformat(),
            "end_time": now.isoformat(),
            "experiment_id": "experiment-1",
        },
    ]
    dev_failure = ExperimentEvaluationRun(
        experiment_run_id="run-2",
        start_time=now,
        end_time=now,
        name="correct_tools_called",
        annotator_kind="CODE",
        result={"score": 0.0, "label": "fail"},
    )
    regression_failure = ExperimentEvaluationRun(
        experiment_run_id="run-1",
        start_time=now,
        end_time=now,
        name="correct_tools_called",
        annotator_kind="CODE",
        result={"score": 0.0, "label": "fail"},
    )

    assert not _has_regression_evaluator_failure(_dataset(), experiment, [dev_failure])
    assert _has_regression_evaluator_failure(_dataset(), experiment, [regression_failure])


def test_summary_dir_writes_json_and_markdown(tmp_path: Path) -> None:
    now = datetime.now(timezone.utc)
    experiment = _ran_experiment()
    experiment["task_runs"] = [
        {
            "id": "run-1",
            "dataset_example_id": "regression-example",
            "output": {},
            "repetition_number": 1,
            "start_time": now.isoformat(),
            "end_time": now.isoformat(),
            "experiment_id": "experiment-1",
        }
    ]
    evaluation_run = ExperimentEvaluationRun(
        experiment_run_id="run-1",
        start_time=now,
        end_time=now,
        name="correct_tools_called",
        annotator_kind="CODE",
        result={"score": 1.0, "label": "pass"},
    )

    _write_summary_files(
        _dataset(),
        experiment,
        [evaluation_run],
        base_url="http://localhost:6006",
        splits=["regression"],
        summary_dir=tmp_path,
    )

    assert (tmp_path / "summary.json").exists()
    summary_md = tmp_path / "summary.md"
    assert summary_md.exists()
    assert "PXI Eval Summary" in summary_md.read_text()


def test_summary_payload_counts_failures() -> None:
    now = datetime.now(timezone.utc)
    experiment = _ran_experiment()
    experiment["task_runs"] = [
        {
            "id": "run-1",
            "dataset_example_id": "regression-example",
            "output": {},
            "repetition_number": 1,
            "start_time": now.isoformat(),
            "end_time": now.isoformat(),
            "experiment_id": "experiment-1",
        }
    ]
    evaluation_run = ExperimentEvaluationRun(
        experiment_run_id="run-1",
        start_time=now,
        end_time=now,
        name="correct_tools_called",
        annotator_kind="CODE",
        result={"score": 0.0, "label": "fail", "explanation": "missing tool"},
    )

    payload = _summary_payload(
        _dataset(),
        experiment,
        [evaluation_run],
        base_url="http://localhost:6006",
        splits=["regression"],
    )

    assert payload["evaluators"]["correct_tools_called"]["failing"] == 1
    assert payload["failed_evaluations"][0]["example_id"] == "regression-example"

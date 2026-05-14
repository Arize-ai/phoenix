"""Unit tests for the standalone PXI eval experiment runner.

Run directly:

    uv run pytest tests/pxi/evals/test_run_experiment.py
"""

from __future__ import annotations

from datetime import datetime, timezone

from phoenix.client.resources.experiments.types import ExperimentEvaluationRun, RanExperiment

from tests.pxi.evals.run_experiment import _failed_evaluation_rows, _format_table, _task_error_rows


def _ran_experiment(*, dataset_id: str = "dataset-1", experiment_id: str = "experiment-1") -> RanExperiment:
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

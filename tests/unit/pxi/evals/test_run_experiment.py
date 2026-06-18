"""Unit tests for the standalone PXI eval experiment runner.

Run directly:

    uv run pytest tests/unit/pxi/evals/test_run_experiment.py
"""

from __future__ import annotations

from datetime import datetime, timezone

import pytest
from phoenix.client.resources.experiments.types import ExperimentEvaluationRun, RanExperiment

from evals.pxi.harness.datasets import EvalDataset
from evals.pxi.harness.reporting import (
    _failed_evaluation_rows,
    _format_table,
    _has_regression_evaluator_failure,
    _print_score_summary,
    _task_error_rows,
)
from evals.pxi.harness.run_experiment import (
    ExperimentConfig,
    _check_evaluations_ran,
    _filter_dataset_examples,
    _get_split_filtered_dataset,
    _phoenix_examples,
    _rewrite_stable_example_ids,
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


def test_score_summary_prints_compare_url(capsys: pytest.CaptureFixture[str]) -> None:
    experiment = _ran_experiment(
        dataset_id="RGF0YXNldDox",
        experiment_id="RXhwZXJpbWVudDoy",
    )

    has_failures = _print_score_summary(_dataset(), experiment, base_url="http://127.0.0.1:6006")

    assert has_failures is False
    captured = capsys.readouterr()
    assert (
        "Experiment: "
        "http://127.0.0.1:6006/datasets/RGF0YXNldDox/compare?experimentId=RXhwZXJpbWVudDoy"
        in captured.out
    )
    assert "http://127.0.0.1:6006/experiments/RXhwZXJpbWVudDoy" not in captured.out


def test_main_defaults_to_regression_split(monkeypatch: pytest.MonkeyPatch) -> None:
    captured: list[ExperimentConfig] = []

    def fake_run(config: ExperimentConfig) -> int:
        captured.append(config)
        return 0

    monkeypatch.setattr("evals.pxi.harness.run_experiment.run", fake_run)

    assert main(["--dataset", "set_spans_filter"]) == 0
    assert captured[0].splits == ("regression",)


def test_main_forwards_report_flags(monkeypatch: pytest.MonkeyPatch) -> None:
    from pathlib import Path

    captured: list[ExperimentConfig] = []

    def fake_run(config: ExperimentConfig) -> int:
        captured.append(config)
        return 0

    monkeypatch.setattr("evals.pxi.harness.run_experiment.run", fake_run)

    assert (
        main(
            [
                "--dataset",
                "set_spans_filter",
                "--report-dir",
                "/tmp/reports",
                "--print-report",
            ]
        )
        == 0
    )
    assert captured[0].report_dir == Path("/tmp/reports")
    assert captured[0].print_report is True


def test_main_defaults_report_flags_off(monkeypatch: pytest.MonkeyPatch) -> None:
    captured: list[ExperimentConfig] = []

    def fake_run(config: ExperimentConfig) -> int:
        captured.append(config)
        return 0

    monkeypatch.setattr("evals.pxi.harness.run_experiment.run", fake_run)

    assert main(["--dataset", "set_spans_filter"]) == 0
    assert captured[0].report_dir is None
    assert captured[0].print_report is False
    assert captured[0].retry_failed is False


def test_main_forwards_retry_failed_flag(monkeypatch: pytest.MonkeyPatch) -> None:
    captured: list[ExperimentConfig] = []

    def fake_run(config: ExperimentConfig) -> int:
        captured.append(config)
        return 0

    monkeypatch.setattr("evals.pxi.harness.run_experiment.run", fake_run)

    assert main(["--dataset", "set_spans_filter", "--retry-failed"]) == 0
    assert captured[0].retry_failed is True


def test_main_forwards_explicit_splits(monkeypatch: pytest.MonkeyPatch) -> None:
    captured: list[ExperimentConfig] = []

    def fake_run(config: ExperimentConfig) -> int:
        captured.append(config)
        return 0

    monkeypatch.setattr("evals.pxi.harness.run_experiment.run", fake_run)

    assert main(["--dataset", "set_spans_filter", "--splits", "dev", "val"]) == 0
    assert captured[0].splits == ("dev", "val")


def test_phoenix_examples_include_splits() -> None:
    examples = _phoenix_examples(_dataset())

    assert examples[0]["id"] == "regression-example"
    assert examples[0]["splits"] == ["regression"]


def test_phoenix_examples_include_holdout_split() -> None:
    dataset = EvalDataset.model_validate(
        {
            "dataset_name": "example_suite",
            "evaluators": ["correct_tools_called"],
            "examples": [
                {
                    "id": "holdout-example",
                    "splits": ["holdout"],
                    "input": {"query": "x"},
                    "expected": {"tools": {"required": []}},
                },
            ],
        }
    )

    examples = _phoenix_examples(dataset)

    assert examples[0]["splits"] == ["holdout"]


@pytest.mark.asyncio
async def test_split_filtered_dataset_forwards_requested_splits() -> None:
    class FakeDatasets:
        def __init__(self) -> None:
            self.calls: list[dict[str, object]] = []

        async def get_dataset(self, *, dataset: object, splits: list[str]) -> str:
            self.calls.append({"dataset": dataset, "splits": splits})
            return "filtered-dataset"

    class FakeClient:
        def __init__(self) -> None:
            self.datasets = FakeDatasets()

    client = FakeClient()

    result = await _get_split_filtered_dataset(client, "uploaded-dataset", ("dev", "val"))  # type: ignore[arg-type]

    assert result == "filtered-dataset"
    assert client.datasets.calls == [{"dataset": "uploaded-dataset", "splits": ["dev", "val"]}]


def test_check_evaluations_ran_raises_on_vacuous_pass() -> None:
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

    with pytest.raises(RuntimeError, match="zero evaluations"):
        _check_evaluations_ran(experiment)


def test_check_evaluations_ran_accepts_empty_experiment_and_real_evaluations() -> None:
    now = datetime.now(timezone.utc)
    empty = _ran_experiment()
    _check_evaluations_ran(empty)  # no task runs -> nothing expected

    evaluated = _ran_experiment()
    evaluated["task_runs"] = [
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
    evaluated["evaluation_runs"] = [
        ExperimentEvaluationRun(
            experiment_run_id="run-1",
            start_time=now,
            end_time=now,
            name="correct_tools_called",
            annotator_kind="CODE",
            result={"score": 1.0},
        )
    ]
    _check_evaluations_ran(evaluated)


def test_check_evaluations_ran_accepts_task_error_only_experiment() -> None:
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
            "error": "TimeoutError: task timed out",
        }
    ]

    _check_evaluations_ran(experiment)


class _FakeDatasetWithExamples:
    def __init__(self, examples: list[dict[str, object]]) -> None:
        self.examples = examples


class _FakePhoenixDataset:
    def __init__(self, examples: list[dict[str, object]]) -> None:
        self._examples = examples

    def to_dict(self) -> dict[str, object]:
        return {
            "id": "dataset-1",
            "name": "Example Dataset",
            "version_id": "dataset-version-1",
            "examples": self._examples,
        }


def test_rewrite_stable_example_ids_maps_global_ids_even_without_output() -> None:
    """Task runs whose output is None (e.g. client-level timeout) must still
    resolve to stable YAML ids via the dataset GlobalID mapping."""
    now = datetime.now(timezone.utc)
    experiment = _ran_experiment()
    experiment["task_runs"] = [
        {
            "id": "run-1",
            "dataset_example_id": "RGF0YXNldEV4YW1wbGU6MQ==",
            "output": None,
            "repetition_number": 1,
            "start_time": now.isoformat(),
            "end_time": now.isoformat(),
            "experiment_id": "experiment-1",
            "error": "TimeoutError()",
        },
        {
            "id": "run-2",
            "dataset_example_id": "RGF0YXNldEV4YW1wbGU6Mg==",
            "output": {"stable_example_id": "from-output-example"},
            "repetition_number": 1,
            "start_time": now.isoformat(),
            "end_time": now.isoformat(),
            "experiment_id": "experiment-1",
        },
        {
            "id": "run-3",
            "dataset_example_id": "unmapped-global-id",
            "output": None,
            "repetition_number": 1,
            "start_time": now.isoformat(),
            "end_time": now.isoformat(),
            "experiment_id": "experiment-1",
        },
    ]
    dataset = _FakeDatasetWithExamples(
        [
            {"id": "regression-example", "node_id": "RGF0YXNldEV4YW1wbGU6MQ=="},
            {"id": "dev-example", "node_id": "RGF0YXNldEV4YW1wbGU6Mg=="},
        ]
    )

    _rewrite_stable_example_ids(experiment, dataset)

    assert experiment["task_runs"][0]["dataset_example_id"] == "regression-example"
    assert experiment["task_runs"][1]["dataset_example_id"] == "dev-example"
    # Unmapped ids without output fall through unchanged rather than crashing.
    assert experiment["task_runs"][2]["dataset_example_id"] == "unmapped-global-id"


def test_filter_dataset_examples_preserves_dataset_version_and_selects_ids() -> None:
    dataset = _FakePhoenixDataset(
        [
            {"id": "regression-example", "input": {}, "output": {}, "metadata": {}},
            {"id": "dev-example", "input": {}, "output": {}, "metadata": {}},
        ]
    )

    filtered = _filter_dataset_examples(dataset, ("regression-example",))

    assert filtered.id == "dataset-1"
    assert filtered.version_id == "dataset-version-1"
    assert [example["id"] for example in filtered.examples] == ["regression-example"]


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

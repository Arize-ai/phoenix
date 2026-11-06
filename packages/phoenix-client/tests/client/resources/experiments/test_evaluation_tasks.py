# pyright: reportPrivateUsage=false
from typing import Any, cast

from phoenix.client.__generated__ import v1
from phoenix.client.resources.experiments import (
    _build_evaluation_tasks,
    _evaluators_by_name,
    _example_global_id,
)


def _example(id_: str, node_id: str) -> v1.DatasetExample:
    return {
        "id": id_,
        "node_id": node_id,
        "input": {"question": "q"},
        "output": {"answer": "a"},
        "metadata": {},
        "updated_at": "2026-01-01T00:00:00+00:00",
    }


def _run(dataset_example_id: str) -> v1.ExperimentRun:
    return {
        "dataset_example_id": dataset_example_id,
        "output": "task output",
        "repetition_number": 1,
        "start_time": "2026-01-01T00:00:00+00:00",
        "end_time": "2026-01-01T00:00:01+00:00",
        "id": "ExperimentRun:1",
        "experiment_id": "Experiment:1",
    }


def _evaluator(output: Any) -> float:
    return 1.0


class TestExampleGlobalId:
    def test_returns_node_id_not_custom_id(self) -> None:
        example = _example("my-custom-id", "RGF0YXNldEV4YW1wbGU6MQ==")
        assert _example_global_id(example) == "RGF0YXNldEV4YW1wbGU6MQ=="

    def test_falls_back_to_id_when_node_id_is_absent(self) -> None:
        example = cast(
            v1.DatasetExample,
            {
                "id": "RGF0YXNldEV4YW1wbGU6MQ==",
                "input": {},
                "output": {},
                "metadata": {},
                "updated_at": "2026-01-01T00:00:00+00:00",
            },
        )
        assert _example_global_id(example) == "RGF0YXNldEV4YW1wbGU6MQ=="


class TestBuildEvaluationTasks:
    def test_runs_keyed_by_node_id_match_examples_with_custom_ids(self) -> None:
        examples = [
            _example("custom-1", "RGF0YXNldEV4YW1wbGU6MQ=="),
            _example("custom-2", "RGF0YXNldEV4YW1wbGU6Mg=="),
        ]
        task_runs = [_run("RGF0YXNldEV4YW1wbGU6MQ=="), _run("RGF0YXNldEV4YW1wbGU6Mg==")]
        evaluation_tasks = _build_evaluation_tasks(
            task_runs,
            _evaluators_by_name({"evaluator": _evaluator}),
            {_example_global_id(ex): ex for ex in examples},
        )
        assert [(ex["id"], run["dataset_example_id"]) for ex, run, _ in evaluation_tasks] == [
            ("custom-1", "RGF0YXNldEV4YW1wbGU6MQ=="),
            ("custom-2", "RGF0YXNldEV4YW1wbGU6Mg=="),
        ]

    def test_unmatched_runs_are_skipped(self) -> None:
        examples = [_example("custom-1", "RGF0YXNldEV4YW1wbGU6MQ==")]
        task_runs = [_run("RGF0YXNldEV4YW1wbGU6MQ=="), _run("RGF0YXNldEV4YW1wbGU6OTk=")]
        evaluation_tasks = _build_evaluation_tasks(
            task_runs,
            _evaluators_by_name({"evaluator": _evaluator}),
            {_example_global_id(ex): ex for ex in examples},
        )
        assert len(evaluation_tasks) == 1

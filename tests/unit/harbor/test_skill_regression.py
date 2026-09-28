import json
from copy import deepcopy
from pathlib import Path
from unittest.mock import MagicMock

import pytest

from evals.report_plugin_experiment import report
from evals.skill_regression import check_harbor, check_plugin, plugin_cases, plugin_contract


def _plugin_result() -> dict:
    return {
        "schemaVersion": 1,
        "partial": False,
        "suite": {"ablation": "with-without"},
        "cases": [
            {
                "name": name,
                "promptMarkdown": plugin_contract(name)[0],
                "graders": plugin_contract(name)[1],
                "arms": {
                    arm: [
                        {
                            "error": None,
                            "graders": [
                                {
                                    "name": g["name"],
                                    "passed": True,
                                    "scored": g["type"] != "tool_used",
                                }
                                for g in plugin_contract(name)[1]
                            ],
                        }
                        for _ in range(3)
                    ]
                    for arm in ("with", "without")
                },
                "aggregates": {"score": 1.0, "delta": 0.2},
            }
            for name in plugin_cases("evals")
        ],
    }


def test_plugin_accepts_repeated_success_not_a_single_sample() -> None:
    result = _plugin_result()
    assert not check_plugin(result, "evals", "test-model")
    result["cases"][0]["arms"]["with"].pop()
    assert any("too few runs" in f for f in check_plugin(result, "evals", "test-model"))


def test_plugin_activation_is_gated_even_when_ablation_does_not_score_it() -> None:
    result = _plugin_result()
    for run in result["cases"][0]["arms"]["with"][:2]:
        run["graders"][0]["passed"] = False
    failures = check_plugin(result, "evals", "test-model")
    assert any(
        "skill=phoenix-evals" in f and "grader=skill-fired" in f and "model=test-model" in f
        for f in failures
    )


def test_without_arm_can_omit_with_only_activation_indicators() -> None:
    result = _plugin_result()
    for case in result["cases"]:
        if "-neg-" not in case["name"]:
            for run in case["arms"]["without"]:
                run["graders"].pop(0)
    assert not check_plugin(result, "evals", "test-model")


@pytest.mark.parametrize(
    "failure",
    [
        "partial",
        "missing-case",
        "missing-grader",
        "error",
        "aborted",
        "skippedPaidGraders",
        "nan-score",
        "redefined-grader",
        "deleted-grader-definition",
        "changed-prompt",
    ],
)
def test_plugin_rejects_incomplete_results(failure: str) -> None:
    result = _plugin_result()
    if failure == "partial":
        result["partial"] = True
    elif failure == "missing-case":
        result["cases"].pop()
    elif failure == "missing-grader":
        result["cases"][0]["arms"]["with"][0]["graders"].pop()
    elif failure == "nan-score":
        result["cases"][0]["aggregates"]["score"] = float("nan")
    elif failure == "redefined-grader":
        result["cases"][0]["graders"][0]["config"]["max"] = 0
    elif failure == "deleted-grader-definition":
        result["cases"][0]["graders"].pop(0)
        for runs in result["cases"][0]["arms"].values():
            for run in runs:
                run["graders"].pop(0)
    elif failure == "changed-prompt":
        result["cases"][0]["promptMarkdown"] = "Different task"
    else:
        result["cases"][0]["arms"]["with"][0][failure] = True
    assert check_plugin(result, "evals", "test-model")


def test_harbor_grader_failure_cannot_hide_in_suite_average(tmp_path: Path) -> None:
    tasks = tmp_path / "tasks"
    task = tasks / "skill_artifacts__example"
    task.mkdir(parents=True)
    (task / "task.toml").write_text('[metadata]\nskill="datasets"\npxi_dataset="skill_artifacts"\n')
    job = tmp_path / "job"
    rewards = {
        name: 1.0
        for name in [
            "reward",
            "correct_tools_called",
            "tool_call_args_match",
            "assistant_json_match",
        ]
    }
    trial = {
        "task_name": task.name,
        "config": {"agent": {"model_name": "test-model"}},
        "finished_at": "2026-09-27T00:00:00Z",
        "verifier_result": {"rewards": rewards},
    }
    for index in range(3):
        path = job / str(index)
        path.mkdir(parents=True)
        record = deepcopy(trial)
        record["trial_name"] = str(index)
        (path / "result.json").write_text(json.dumps(record))
    (job / "config.json").write_text(
        json.dumps({"agents": [{"model_name": "test-model"}], "n_attempts": 3})
    )
    assert not check_harbor(job, tasks)
    for index in range(2):
        path = job / str(index) / "result.json"
        record = json.loads(path.read_text())
        record["verifier_result"]["rewards"]["assistant_json_match"] = 0
        path.write_text(json.dumps(record))
    assert any("grader=assistant_json_match" in f for f in check_harbor(job, tasks))
    (job / "2/result.json").unlink()
    assert any("too few trials" in f for f in check_harbor(job, tasks))
    config = {
        "agents": [{"model_name": "test-model"}, {"model_name": "missing-model"}],
        "n_attempts": 3,
    }
    (job / "config.json").write_text(json.dumps(config))
    assert any(
        "model=missing-model" in f and "missing trials" in f for f in check_harbor(job, tasks)
    )


def test_reporting_preserves_arms_repetitions_and_named_grades() -> None:
    result = _plugin_result()
    result.update(startedAt="2026-09-27T00:00:00Z", claudeVersion="2.1.273")
    for case in result["cases"]:
        for runs in case["arms"].values():
            for run in runs:
                run.update(startedAt=result["startedAt"], durationSeconds=2, score=1.0)
    client = MagicMock()
    dataset = client.datasets.create_dataset.return_value
    dataset.id = "dataset"
    dataset.version_id = "version"
    dataset.examples = [
        {"input": {"case": c["name"]}, "id": c["name"], "node_id": f"node-{c['name']}"}
        for c in result["cases"]
    ]
    client.experiments.create.side_effect = [{"id": "with"}, {"id": "without"}]
    client.experiments.log_run.return_value = {"id": "run"}
    assert report(client, result, "evals", "test-model") == ["with", "without"]
    assert client.experiments.log_run.call_count == 8 * 2 * 3
    assert (
        client.experiments.log_run.call_args_list[0]
        .kwargs["dataset_example_id"]
        .startswith("node-")
    )
    evaluations = client.experiments.log_evaluation.call_args_list
    assert len(evaluations) == sum(len(c["graders"]) for c in result["cases"]) * 2 * 3
    assert {call.kwargs["annotator_kind"] for call in evaluations} == {"CODE", "LLM"}
    assert evaluations[0].kwargs["metadata"]["model"] == "test-model"
    assert evaluations[0].kwargs["metadata"]["scored"] is False


def test_partial_reports_do_not_write_to_phoenix() -> None:
    client = MagicMock()
    result = _plugin_result()
    result["partial"] = True
    with pytest.raises(ValueError):
        report(client, result, "evals", "test-model")
    assert not client.mock_calls

"""Exercise plugin-report ingestion against a disposable real Phoenix server.

The input is synthetic transport-test data, never an agent regression baseline.
Set SKILL_EVALS_TEST_ENDPOINT to an isolated server; this test writes datasets.
"""

import os
from datetime import datetime, timezone
from typing import Any

import httpx
import pytest
from phoenix.client import Client

from evals.report_plugin_experiment import report
from evals.skill_regression import plugin_cases, plugin_contract


def test_reporting_persists_repetitions_grades_and_stable_examples() -> None:
    endpoint = os.environ.get("SKILL_EVALS_TEST_ENDPOINT")
    if not endpoint:
        pytest.skip("Set SKILL_EVALS_TEST_ENDPOINT to a disposable Phoenix server")
    started = datetime.now(timezone.utc).isoformat()
    cases: list[dict[str, Any]] = []
    for name in plugin_cases("evals"):
        prompt, graders = plugin_contract(name)
        cases.append(
            {
                "name": name,
                "promptMarkdown": prompt,
                "graders": graders,
                "arms": {
                    arm: [
                        {
                            "startedAt": started,
                            "durationSeconds": 0.1,
                            "score": 0.0 if repetition == 1 else 1.0,
                            "error": "synthetic transport-test error" if repetition == 1 else None,
                            "graders": [
                                {
                                    "name": g["name"],
                                    "passed": repetition != 1,
                                    "scored": g["type"] != "tool_used",
                                    "explanation": "Synthetic reporting test; no model executed",
                                }
                                for g in graders
                            ],
                        }
                        for repetition in range(1, 4)
                    ]
                    for arm in ("with", "without")
                },
            }
        )
    payload: dict[str, Any] = {
        "schemaVersion": 1,
        "partial": False,
        "suite": {"ablation": "with-without"},
        "claudeVersion": "synthetic-reporting-test",
        "startedAt": started,
        "cases": cases,
    }
    client = Client(base_url=endpoint)
    experiment_ids = report(client, payload, "evals", "synthetic-reporting-test")
    dataset = client.datasets.get_dataset(dataset="phoenix-skills-plugin-evals")
    initial_ids = {example["id"] for example in dataset.examples}
    assert len(initial_ids) == len(cases)
    for arm, experiment_id in zip(("with", "without"), experiment_ids):
        experiment = client.experiments.get(experiment_id=experiment_id)
        assert experiment["metadata"]["arm"] == arm
        assert experiment["metadata"]["model"] == "synthetic-reporting-test"
        response = httpx.get(f"{endpoint}/v1/experiments/{experiment_id}/json", timeout=30)
        response.raise_for_status()
        records = response.json()
        assert len(records) == len(cases) * 3
        assert {record["repetition_number"] for record in records} == {1, 2, 3}
        by_name = {case["name"]: case for case in cases}
        for record in records:
            annotations = record["annotations"]
            assert annotations
            case_name = annotations[0]["metadata"]["case"]
            assert {a["name"] for a in annotations} == {
                g["name"] for g in by_name[case_name]["graders"]
            }
            for annotation in annotations:
                assert annotation["score"] == (0.0 if record["repetition_number"] == 1 else 1.0)
                assert annotation["metadata"]["harness"] == "claude-plugin"
                assert annotation["metadata"]["skill"] == "phoenix-evals"
                assert annotation["metadata"]["arm"] == arm
                assert annotation["explanation"] == "Synthetic reporting test; no model executed"
        runs = client.experiments.get_experiment(experiment_id=experiment_id)["task_runs"]
        assert sum(bool(run["error"]) for run in runs) == len(cases)
    # A second import creates new experiments, but reuses the suite's example IDs.
    second_ids = report(client, payload, "evals", "synthetic-reporting-test")
    assert set(second_ids).isdisjoint(experiment_ids)
    dataset = client.datasets.get_dataset(dataset="phoenix-skills-plugin-evals")
    assert {example["id"] for example in dataset.examples} == initial_ids

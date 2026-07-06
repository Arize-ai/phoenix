from __future__ import annotations

import json
from pathlib import Path

from evals.pxi.experiments.context_pruning.corpus_builder import (
    gate_type_a_zero_dataset,
    gate_type_b_5k_dataset,
    gate_type_b_zero_dataset,
)
from evals.pxi.experiments.context_pruning.gates import (
    gate_commands,
    pass_rate_from_json,
    summarize_gates,
    write_gate_report,
)


def test_gate_datasets_have_preregistered_sizes() -> None:
    assert len(gate_type_a_zero_dataset()["examples"]) == 40
    assert len(gate_type_b_zero_dataset()["examples"]) == 36
    assert len(gate_type_b_5k_dataset()["examples"]) == 36


def test_type_b_zero_gate_removes_prefix_but_keeps_expected_needle() -> None:
    example = gate_type_b_zero_dataset()["examples"][0]

    assert "context_pruning_prefix" not in example["input"]
    assert example["input"]["messages"] == [
        {"role": "user", "content": example["input"]["messages"][0]["content"]}
    ]
    assert example["metadata"]["context_pruning"]["depth_tokens"] == 0
    assert example["metadata"]["context_pruning"]["needle"] in json.dumps(example["expected"])


def test_gate_commands_use_report_dir_and_policy_flag(tmp_path: Path) -> None:
    commands = gate_commands(policies=("p0", "p2"), report_dir=tmp_path)

    assert len(commands) == 6
    assert "--policy" not in commands[0]
    assert commands[1][-4:] == [
        "--policy",
        "p2",
        "--report-dir",
        str(tmp_path / "context-pruning-gate-type_a_zero-p2"),
    ]


def test_pass_rate_from_failure_report_json(tmp_path: Path) -> None:
    path = tmp_path / "report.json"
    path.write_text(json.dumps({"examples_run": 10, "examples_passed": 8}), encoding="utf-8")

    assert pass_rate_from_json(path) == (8, 10, 0.8)


def test_pass_rate_from_experiment_json(tmp_path: Path) -> None:
    path = tmp_path / "experiment.json"
    path.write_text(
        json.dumps(
            {
                "task_runs": [{"id": "run-1", "output": {}}, {"id": "run-2", "output": {}}],
                "evaluation_runs": [
                    {"experiment_run_id": "run-1", "result": {"score": 1.0}},
                    {"experiment_run_id": "run-2", "result": {"score": 0.0}},
                ],
            }
        ),
        encoding="utf-8",
    )

    assert pass_rate_from_json(path) == (1, 2, 0.5)


def test_gate_summary_and_report(tmp_path: Path) -> None:
    report_dir = tmp_path / "reports"
    report_dir.mkdir()
    (report_dir / "context_pruning_gate_type_a_zero.report.json").write_text(
        json.dumps({"examples_run": 40, "examples_passed": 39}), encoding="utf-8"
    )
    (report_dir / "context_pruning_gate_type_b_zero.report.json").write_text(
        json.dumps({"examples_run": 36, "examples_passed": 4}), encoding="utf-8"
    )
    (report_dir / "context_pruning_gate_type_b_5k.report.json").write_text(
        json.dumps({"examples_run": 36, "examples_passed": 20}), encoding="utf-8"
    )

    rows = summarize_gates(report_dir)

    assert [row["status"] for row in rows] == ["pass", "pass", "fail"]

    output = tmp_path / "REPORT.md"
    write_gate_report(rows, output)
    text = output.read_text(encoding="utf-8")
    assert "type_b_5k" in text
    assert "20/36 (56%)" in text

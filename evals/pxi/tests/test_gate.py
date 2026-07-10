"""Unit tests for the PXI aggregate gate (``evals/pxi/gate.py``).

Covers the fail-closed paths a green gate must never let through: a schema
mismatch and a run that completed examples but scored zero or too few evaluator
rows (an id-rewrite bug that silently skips scoring is the motivating case). A
well-formed schema-3 artifact and the pre-existing recording / threshold checks
round out the matrix so the new evaluations-ran check is shown not to disturb
them.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from evals.pxi import conftest as recorder
from evals.pxi import gate

# Recording that is present and consistent, so the recording fail-closed check
# is a no-op and each test isolates the path it targets.
VALID_RECORDING = {"expected": False, "bootstrapped": False, "experiments": 0, "error": None}


def _evaluator(name: str, *, scored: int, passed: int, split: str = "dev") -> dict[str, Any]:
    rate = passed / scored if scored else 0.0
    stats = {
        "rows": scored,
        "assessed": scored,
        "scored": scored,
        "infra": 0,
        "passed": passed,
        "failed": scored - passed,
        "pass_rate": rate,
    }
    return {
        "evaluator": name,
        **stats,
        "splits": {split: stats},
    }


def _artifact(
    *, completed: int, datasets: list[dict[str, Any]], schema_version: int = 4
) -> dict[str, Any]:
    # collected == completed keeps the partial-completion check quiet, so only
    # the path under test can fail.
    return {
        "schema_version": schema_version,
        "session": {"status": 0, "collected": completed, "completed": completed, "errors": 0},
        "recording": VALID_RECORDING,
        "datasets": datasets,
    }


def _run_gate(tmp_path: Path, artifact: dict[str, Any], *, min_pass_rate: float = 0.0) -> int:
    artifact_path = tmp_path / "pxi-eval-results.json"
    artifact_path.write_text(json.dumps(artifact))
    thresholds_path = tmp_path / "thresholds.yaml"
    thresholds_path.write_text(f"splits:\n  dev:\n    min_pass_rate: {min_pass_rate}\n")
    return gate.main([str(artifact_path), "--thresholds", str(thresholds_path)])


def test_zero_scored_rows_with_completed_examples_fails_closed(tmp_path: Path) -> None:
    # datasets: [] but the session completed examples -- the id-rewrite false green.
    artifact = _artifact(completed=2, datasets=[])
    assert _run_gate(tmp_path, artifact) == gate.EXIT_INVALID


def test_fewer_scored_rows_than_completed_fails_closed(tmp_path: Path) -> None:
    # Rows silently dropped: 3 examples completed, only 2 evaluator rows scored.
    datasets = [{"dataset": "d1", "evaluators": [_evaluator("e1", scored=2, passed=2)]}]
    artifact = _artifact(completed=3, datasets=datasets)
    assert _run_gate(tmp_path, artifact) == gate.EXIT_INVALID


def test_wellformed_schema4_artifact_passes(tmp_path: Path) -> None:
    datasets = [{"dataset": "d1", "evaluators": [_evaluator("e1", scored=2, passed=2)]}]
    artifact = _artifact(completed=2, datasets=datasets)
    assert _run_gate(tmp_path, artifact) == gate.EXIT_OK


def test_schema_version_3_is_rejected(tmp_path: Path) -> None:
    datasets = [{"dataset": "d1", "evaluators": [_evaluator("e1", scored=2, passed=2)]}]
    artifact = _artifact(completed=2, datasets=datasets, schema_version=3)
    assert _run_gate(tmp_path, artifact) == gate.EXIT_INVALID


def test_expected_recording_not_bootstrapped_still_fails_closed(tmp_path: Path) -> None:
    # The evaluations-ran check must not weaken the recording assertion.
    datasets = [{"dataset": "d1", "evaluators": [_evaluator("e1", scored=2, passed=2)]}]
    artifact = _artifact(completed=2, datasets=datasets)
    artifact["recording"] = {
        "expected": True,
        "bootstrapped": False,
        "experiments": 0,
        "error": "bootstrap failed",
    }
    assert _run_gate(tmp_path, artifact) == gate.EXIT_INVALID


def test_valid_artifact_below_threshold_returns_breach(tmp_path: Path) -> None:
    # total_scored >= completed so validity passes; the pass-rate then breaches.
    datasets = [{"dataset": "d1", "evaluators": [_evaluator("e1", scored=2, passed=0)]}]
    artifact = _artifact(completed=2, datasets=datasets)
    assert _run_gate(tmp_path, artifact, min_pass_rate=0.5) == gate.EXIT_BREACH


def test_artifact_aggregates_assessed_and_infra_rows_separately(
    monkeypatch: Any,
) -> None:
    rows = [
        {
            "dataset": "d1",
            "example_id": "pass",
            "nodeid": "test.py::test_eval[pass]",
            "evaluator": "e1",
            "split": "regression",
            "score": 1.0,
            "passed": True,
        },
        {
            "dataset": "d1",
            "example_id": "miss",
            "nodeid": "test.py::test_eval[miss]",
            "evaluator": "e1",
            "split": "regression",
            "score": 0.0,
            "passed": False,
            "label": "missing_required",
            "explanation": "Required tool was not called",
        },
        {
            "dataset": "d1",
            "example_id": "provider-error",
            "nodeid": "test.py::test_eval[provider-error]",
            "evaluator": "e1",
            "split": "regression",
            "score": None,
            "passed": False,
            "task_error": "HTTP 520 from provider",
        },
    ]
    monkeypatch.setattr(recorder, "_rows", rows)

    artifact = recorder._build_artifact(0, VALID_RECORDING)

    assert artifact["schema_version"] == 4
    assert artifact["rows"] == rows
    stats = artifact["datasets"][0]["evaluators"][0]["splits"]["regression"]
    assert stats == {
        "rows": 3,
        "assessed": 2,
        "scored": 2,
        "infra": 1,
        "passed": 1,
        "failed": 1,
        "pass_rate": 0.5,
    }

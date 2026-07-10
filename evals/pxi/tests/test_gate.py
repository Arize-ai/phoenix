"""Outcome-matrix tests for the trustworthy PXI aggregate gate."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from evals.pxi import conftest as recorder
from evals.pxi import gate

VALID_RECORDING: dict[str, Any] = {
    "expected": False,
    "bootstrapped": False,
    "experiments": 0,
    "error": None,
    "datasets": [],
}


def _row(
    example_id: str,
    *,
    passed: bool,
    evaluator: str = "correct_tools_called",
    dataset: str = "suite",
    split: str = "regression",
    task_error: str | None = None,
    evaluator_error: str | None = None,
    explanation: str | None = None,
) -> dict[str, Any]:
    row: dict[str, Any] = {
        "dataset": dataset,
        "example_id": example_id,
        "nodeid": f"evals/pxi/tests/test_pxi_evals.py::test_pxi_eval[{dataset}-{example_id}]",
        "evaluator": evaluator,
        "split": split,
        "score": 1.0 if passed else 0.0,
        "passed": passed,
        "label": "pass" if passed else "missing_required",
    }
    if task_error:
        row.update(score=None, task_error=task_error)
    if evaluator_error:
        row.update(score=None, evaluator_error=evaluator_error)
    if explanation:
        row["explanation"] = explanation
    return row


def _artifact(
    rows: list[dict[str, Any]],
    *,
    status: int = 0,
    collected: int | None = None,
    completed: int | None = None,
    errors: int = 0,
    schema_version: int = 4,
    recording: dict[str, Any] | None = None,
) -> dict[str, Any]:
    nodeids = {str(row["nodeid"]) for row in rows}
    count = len(nodeids) if collected is None else collected
    old_rows = recorder._rows
    old_health = recorder._health
    try:
        recorder._rows = rows
        recorder._health = {
            "collected": count,
            "completed": count if completed is None else completed,
            "errors": errors,
        }
        artifact = recorder._build_artifact(status, recording or VALID_RECORDING)
    finally:
        recorder._rows = old_rows
        recorder._health = old_health
    artifact["schema_version"] = schema_version
    return artifact


def _policy(minimum: float = 1.0) -> dict[str, Any]:
    return {
        "splits": {"regression": {"min_pass_rate": minimum}, "val": {"gating": False}},
        "overrides": {},
    }


def _write_policy(path: Path, minimum: float = 1.0) -> None:
    path.write_text(
        f"splits:\n  regression:\n    min_pass_rate: {minimum}\n  val:\n    gating: false\n"
    )


def _run_gate(
    tmp_path: Path,
    initial: dict[str, Any],
    *,
    retry: dict[str, Any] | None = None,
    planning: bool = False,
    minimum: float = 1.0,
) -> tuple[int, Path, Path]:
    initial_path = tmp_path / "initial.json"
    initial_path.write_text(json.dumps(initial))
    thresholds = tmp_path / "thresholds.yaml"
    _write_policy(thresholds, minimum)
    report = tmp_path / "report.md"
    args = [str(initial_path), "--thresholds", str(thresholds), "--report-out", str(report)]
    retry_ids = tmp_path / "retry-nodeids.txt"
    if planning:
        args.extend(("--retry-nodeids-out", str(retry_ids)))
    if retry is not None:
        retry_path = tmp_path / "retry.json"
        retry_path.write_text(json.dumps(retry))
        args.extend(("--retry-artifact", str(retry_path)))
    return gate.main(args), retry_ids, report


def test_artifact_aggregates_assessed_and_infra_rows_separately() -> None:
    rows = [
        _row("pass", passed=True),
        _row("miss", passed=False, explanation="Required tool was not called"),
        _row("provider-error", passed=False, task_error="HTTP 520 from provider"),
    ]

    artifact = _artifact(rows)

    assert artifact["schema_version"] == 4
    assert {row["example_id"] for row in artifact["rows"]} == {
        "pass",
        "miss",
        "provider-error",
    }
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


def test_provider_error_never_enters_behavioral_denominator() -> None:
    decision = gate.decide(
        _artifact(
            [
                _row("pass", passed=True),
                _row("provider-error", passed=False, task_error="provider unavailable"),
            ]
        ),
        _policy(),
    )

    assert decision.exit_code == gate.EXIT_OK
    assert decision.cells[0]["assessed"] == 1
    assert decision.cells[0]["infra"] == 1
    assert decision.cells[0]["pass_rate"] == 1.0
    assert {item.first["example_id"] for item in decision.infra} == {"provider-error"}


def test_missing_evaluator_score_is_counted_as_infra() -> None:
    missing_score = _row("missing-score", passed=False)
    missing_score["score"] = None

    artifact = _artifact([_row("pass", passed=True), missing_score])
    decision = gate.decide(artifact, _policy())

    stats = artifact["datasets"][0]["evaluators"][0]["splits"]["regression"]
    assert stats["assessed"] == 1
    assert stats["infra"] == 1
    assert decision.exit_code == gate.EXIT_OK


def test_gating_cell_with_zero_assessable_rows_is_unmeasurable() -> None:
    decision = gate.decide(
        _artifact([_row("provider-error", passed=False, task_error="HTTP 520")]),
        _policy(),
    )

    assert decision.exit_code == gate.EXIT_INVALID
    assert decision.label == "UNMEASURABLE"
    assert any("zero assessable rows" in error for error in decision.errors)


def test_first_miss_then_pass_is_flaky_recovery(tmp_path: Path) -> None:
    first = _artifact([_row("flaky", passed=False, explanation="Required tool was not called")])
    retry = _artifact([_row("flaky", passed=True)])

    plan_rc, retry_ids, _ = _run_gate(tmp_path, first, planning=True)
    final_rc, _, report = _run_gate(tmp_path, first, retry=retry)

    assert plan_rc == gate.EXIT_OK
    assert retry_ids.read_text().splitlines() == [first["rows"][0]["nodeid"]]
    assert final_rc == gate.EXIT_OK
    assert "FLAKY RECOVERY" in report.read_text()
    assert "Required tool was not called" in report.read_text()


def test_same_assessable_evaluator_miss_twice_confirms_regression(tmp_path: Path) -> None:
    first = _artifact([_row("broken", passed=False, explanation="Required tool was not called")])
    retry = _artifact(
        [_row("broken", passed=False, explanation="Required tool still was not called")]
    )

    rc, _, report = _run_gate(tmp_path, first, retry=retry)

    assert rc == gate.EXIT_BREACH
    digest = report.read_text()
    assert "CONFIRMED REGRESSION" in digest
    assert "Required tool still was not called" in digest
    assert first["rows"][0]["nodeid"] in digest


def test_different_evaluator_miss_on_retry_does_not_confirm_first_miss() -> None:
    first = _artifact(
        [
            _row("example", passed=False, evaluator="tools"),
            _row("example", passed=True, evaluator="args"),
        ]
    )
    retry = _artifact(
        [
            _row("example", passed=True, evaluator="tools"),
            _row("example", passed=False, evaluator="args"),
        ]
    )

    decision = gate.decide(first, _policy(), retry=retry)

    assert decision.exit_code == gate.EXIT_OK
    assert [item.first["evaluator"] for item in decision.flaky] == ["tools"]
    assert decision.confirmed == []


def test_retry_infra_is_visible_but_not_regression_when_cell_remains_measurable() -> None:
    first = _artifact([_row("pass", passed=True), _row("retry-me", passed=False)])
    retry = _artifact(
        [_row("retry-me", passed=False, task_error="TimeoutError: provider timed out")]
    )

    decision = gate.decide(first, _policy(), retry=retry)

    assert decision.exit_code == gate.EXIT_OK
    assert decision.confirmed == []
    assert any(item.first["example_id"] == "retry-me" for item in decision.infra)
    assert decision.cells[0]["assessed"] == 1
    assert decision.cells[0]["infra"] == 1


def test_retry_infra_that_leaves_zero_assessable_rows_is_unmeasurable() -> None:
    first = _artifact([_row("retry-me", passed=False)])
    retry = _artifact([_row("retry-me", passed=False, task_error="TimeoutError")])

    decision = gate.decide(first, _policy(), retry=retry)

    assert decision.exit_code == gate.EXIT_INVALID
    assert decision.label == "UNMEASURABLE"


def test_retry_scope_contains_only_initial_failed_nodeids(tmp_path: Path) -> None:
    first = _artifact([_row("pass", passed=True), _row("fail", passed=False)])

    rc, retry_ids, _ = _run_gate(tmp_path, first, planning=True)

    assert rc == gate.EXIT_OK
    assert retry_ids.read_text().splitlines() == [
        "evals/pxi/tests/test_pxi_evals.py::test_pxi_eval[suite-fail]"
    ]


def test_partial_retry_artifact_is_unmeasurable() -> None:
    first = _artifact([_row("one", passed=False), _row("two", passed=False)])
    retry = _artifact([_row("one", passed=False)], collected=2, completed=1)

    decision = gate.decide(first, _policy(), retry=retry)

    assert decision.exit_code == gate.EXIT_INVALID
    assert any("retry artifact" in error for error in decision.errors)


def test_unexpected_retry_node_is_unmeasurable() -> None:
    first = _artifact([_row("fail", passed=False)])
    retry = _artifact([_row("different", passed=True)])

    decision = gate.decide(first, _policy(), retry=retry)

    assert decision.exit_code == gate.EXIT_INVALID
    assert any("unexpected node IDs" in error for error in decision.errors)


def test_threshold_still_applies_after_confirmation() -> None:
    first = _artifact([_row("pass", passed=True), _row("fail", passed=False)])
    retry = _artifact([_row("fail", passed=False)])

    decision = gate.decide(first, _policy(0.5), retry=retry)

    assert decision.confirmed
    assert decision.exit_code == gate.EXIT_OK
    assert decision.cells[0]["pass_rate"] == 0.5


def test_invalid_or_partial_initial_run_is_unmeasurable(tmp_path: Path) -> None:
    initial = _artifact([_row("one", passed=True)], collected=2, completed=1, status=1, errors=1)

    rc, retry_ids, report = _run_gate(tmp_path, initial, planning=True)

    assert rc == gate.EXIT_INVALID
    assert retry_ids.read_text() == ""
    assert "UNMEASURABLE" in report.read_text()
    assert "only 1/2 collected items completed" in report.read_text()


def test_vacuous_artifact_with_completed_examples_fails_closed() -> None:
    artifact = _artifact([], collected=2, completed=2)

    decision = gate.decide(artifact, _policy())

    assert decision.exit_code == gate.EXIT_INVALID
    assert any("only 0 evaluator row" in error for error in decision.errors)


def test_expected_recording_not_bootstrapped_still_fails_closed() -> None:
    recording = {
        "expected": True,
        "bootstrapped": False,
        "experiments": 0,
        "error": "bootstrap failed",
        "datasets": [],
    }
    decision = gate.decide(_artifact([_row("pass", passed=True)], recording=recording), _policy())

    assert decision.exit_code == gate.EXIT_INVALID
    assert any("recording was expected" in error for error in decision.errors)


def test_old_schema_is_rejected() -> None:
    decision = gate.decide(_artifact([_row("pass", passed=True)], schema_version=3), _policy())

    assert decision.exit_code == gate.EXIT_INVALID


def test_missing_policy_is_unmeasurable_not_regression() -> None:
    decision = gate.decide(_artifact([_row("pass", passed=True)]), {"splits": {}, "overrides": {}})

    assert decision.exit_code == gate.EXIT_INVALID
    assert any("no threshold policy" in error for error in decision.errors)


def test_digest_includes_evaluator_details_and_both_phoenix_links() -> None:
    first = _artifact(
        [_row("broken", passed=False, explanation="missing get_spans")],
        recording={
            **VALID_RECORDING,
            "datasets": [
                {
                    "dataset": "suite",
                    "experiment_url": "https://phoenix.example/initial",
                }
            ],
        },
    )
    retry = _artifact(
        [_row("broken", passed=False, explanation="still missing get_spans")],
        recording={
            **VALID_RECORDING,
            "datasets": [
                {
                    "dataset": "suite",
                    "experiment_url": "https://phoenix.example/retry",
                }
            ],
        },
    )
    decision = gate.decide(first, _policy(), retry=retry)

    digest = gate.render_digest(decision, first, retry)

    assert "missing get_spans" in digest
    assert "still missing get_spans" in digest
    assert "[first](https://phoenix.example/initial)" in digest
    assert "[retry](https://phoenix.example/retry)" in digest

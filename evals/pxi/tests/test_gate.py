"""Outcome-matrix tests for the trustworthy PXI aggregate gate."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest

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
    retry_cap: int | None = None,
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
    if retry_cap is not None:
        args.extend(("--retry-cap", str(retry_cap)))
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


def test_incidental_retry_infra_is_still_reported() -> None:
    first = _artifact(
        [
            _row("example", passed=False, evaluator="tools"),
            _row("example", passed=True, evaluator="args"),
        ]
    )
    retry = _artifact(
        [
            _row("example", passed=True, evaluator="tools"),
            _row("example", passed=False, evaluator="args", evaluator_error="judge crashed"),
        ]
    )

    decision = gate.decide(first, _policy(), retry=retry)

    assert decision.exit_code == gate.EXIT_OK
    assert [item.first["evaluator"] for item in decision.infra] == ["args"]


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


def test_task_error_on_first_attempt_is_retried(tmp_path: Path) -> None:
    """A task error carries no behavioral signal either way -- retry it like a
    clean miss instead of writing the example off after one try."""
    first = _artifact([_row("provider-error", passed=False, task_error="HTTP 520")])

    rc, retry_ids, _ = _run_gate(tmp_path, first, planning=True)

    assert rc == gate.EXIT_OK
    assert retry_ids.read_text().splitlines() == [first["rows"][0]["nodeid"]]


def test_task_error_recovers_on_retry() -> None:
    first = _artifact([_row("provider-error", passed=False, task_error="HTTP 520")])
    retry = _artifact([_row("provider-error", passed=True)])

    decision = gate.decide(first, _policy(), retry=retry)

    assert decision.exit_code == gate.EXIT_OK
    assert decision.label == "FLAKY RECOVERY"
    assert decision.cells[0]["assessed"] == 1
    assert decision.cells[0]["passed"] == 1


def test_recurring_task_error_is_unmeasurable_not_a_regression() -> None:
    """Two independent failures to execute still can't be attributed to the
    agent -- report it plainly and keep it out of the pass-rate math, never as
    a confirmed regression."""
    first = _artifact([_row("provider-error", passed=False, task_error="HTTP 520")])
    retry = _artifact([_row("provider-error", passed=False, task_error="HTTP 520 again")])

    decision = gate.decide(first, _policy(), retry=retry)

    assert decision.exit_code == gate.EXIT_INVALID
    assert decision.label == "UNMEASURABLE"
    assert decision.confirmed == []
    assert [item.reason for item in decision.infra] == ["recurring task error: HTTP 520 again"]


def test_task_error_then_single_retry_miss_cannot_be_confirmed() -> None:
    """Attempt 1 was a task error (no behavioral signal) and only the retry
    produced a miss. That is a single assessable miss, not the "same miss twice"
    the confirm-on-retry contract requires, and the one retry is already spent --
    so the gate must not red on an unreproduced miss. With no other assessable
    row, the cell is unmeasurable, never a confirmed regression."""
    first = _artifact([_row("provider-error", passed=False, task_error="HTTP 520")])
    retry = _artifact(
        [_row("provider-error", passed=False, explanation="Required tool was not called")]
    )

    decision = gate.decide(first, _policy(), retry=retry)

    assert decision.exit_code == gate.EXIT_INVALID
    assert decision.label == "UNMEASURABLE"
    assert decision.confirmed == []
    assert any("cannot confirm a regression" in (item.reason or "") for item in decision.infra)


def test_zero_assessable_cell_gets_a_retry_chance_before_unmeasurable(tmp_path: Path) -> None:
    """A cell whose only row is an unretried task error must not be declared
    unmeasurable before that row gets its one shot at a real result."""
    first = _artifact([_row("provider-error", passed=False, task_error="HTTP 520")])

    plan_rc, retry_ids, _ = _run_gate(tmp_path, first, planning=True)

    assert plan_rc == gate.EXIT_OK
    assert retry_ids.read_text().strip() != ""


def test_bystander_evaluator_task_error_on_retry_is_still_reported() -> None:
    """A retried node reruns every evaluator on it. If the shared task crashes
    on retry, that crash hits an evaluator that already passed attempt 1 too
    -- it shouldn't flip that evaluator's verdict, but the crash must still be
    visible instead of silently vanishing behind the one evaluator being
    confirmed."""
    first = _artifact(
        [
            _row("example", passed=False, evaluator="tools"),
            _row("example", passed=True, evaluator="args"),
            # Keeps the "tools" cell measurable after retry so this test
            # isolates the bystander-reporting question from the (separately
            # tested) zero-assessable-cell case.
            _row("other", passed=True, evaluator="tools"),
            _row("other", passed=True, evaluator="args"),
        ]
    )
    retry = _artifact(
        [
            _row("example", passed=False, evaluator="tools", task_error="TimeoutError"),
            _row("example", passed=False, evaluator="args", task_error="TimeoutError"),
        ],
        collected=1,
    )

    decision = gate.decide(first, _policy(), retry=retry)

    assert decision.exit_code == gate.EXIT_OK
    assert {item.first["evaluator"] for item in decision.infra} == {"tools", "args"}
    # args passed attempt 1 and wasn't part of the retry decision -- its
    # verdict stands even though the shared retry task crashed.
    args_cell = next(c for c in decision.cells if c["evaluator"] == "args")
    assert args_cell["assessed"] == 2
    assert args_cell["passed"] == 2


def test_retry_skipped_and_gate_fails_when_failures_exceed_cap(tmp_path: Path) -> None:
    """Ported from PR #13845's ``test_gate_skips_retry_when_over_cap``: past a
    cap, mass failure is structural, not worth confirming example by example --
    retrying each one just delays a result that was never in doubt."""
    first = _artifact(
        [_row("one", passed=False), _row("two", passed=False), _row("three", passed=False)]
    )

    plan_rc, retry_ids, _ = _run_gate(tmp_path, first, planning=True, retry_cap=2)

    assert plan_rc == gate.EXIT_BREACH
    assert retry_ids.read_text() == ""

    final_rc, _, report = _run_gate(tmp_path, first, retry_cap=2)

    assert final_rc == gate.EXIT_BREACH
    digest = report.read_text()
    assert "TOO MANY FAILURES TO CONFIRM" in digest
    assert "exceeding the cap of 2" in digest


def test_failures_within_cap_still_retry_normally(tmp_path: Path) -> None:
    first = _artifact([_row("one", passed=False), _row("two", passed=False)])

    rc, retry_ids, _ = _run_gate(tmp_path, first, planning=True, retry_cap=2)

    assert rc == gate.EXIT_OK
    assert len(retry_ids.read_text().splitlines()) == 2


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


def test_task_error_then_retry_miss_does_not_red_a_cell_with_other_passes() -> None:
    """The same single-miss-after-task-error case, but the cell has another
    passing example, so it stays measurable. The unconfirmable miss is surfaced
    as unassessed and the gate does not red -- an unreproduced miss never
    reddens the gate."""
    first = _artifact(
        [
            _row("pass", passed=True),
            _row("provider-error", passed=False, task_error="HTTP 520"),
        ]
    )
    retry = _artifact(
        [_row("provider-error", passed=False, explanation="Required tool was not called")]
    )

    decision = gate.decide(first, _policy(), retry=retry)

    assert decision.exit_code == gate.EXIT_OK
    assert decision.confirmed == []
    assert any(item.first["example_id"] == "provider-error" for item in decision.infra)
    assert decision.cells[0]["assessed"] == 1
    assert decision.cells[0]["infra"] == 1


def test_mass_task_errors_over_cap_are_unmeasurable_not_a_pass(tmp_path: Path) -> None:
    """Ported concern from review: past the retry cap the retry is skipped, but
    task errors we never resolved must not be silently excluded into a green
    PASSED just because one other row in the cell passed."""
    rows = [
        _row(f"provider-error-{index}", passed=False, task_error="HTTP 520") for index in range(3)
    ]
    rows.append(_row("clean-pass", passed=True))
    first = _artifact(rows)

    final_rc, _, report = _run_gate(tmp_path, first, retry_cap=2)

    assert final_rc == gate.EXIT_INVALID
    digest = report.read_text()
    assert "UNMEASURABLE" in digest
    assert "unresolved task errors" in digest


def test_mass_behavioral_misses_over_cap_still_fail_not_unmeasurable(tmp_path: Path) -> None:
    """A cap tripped by clean misses (not task errors) that breach is a real
    failure -- it stays exit 1, distinct from the mass-task-error case above."""
    first = _artifact(
        [_row("one", passed=False), _row("two", passed=False), _row("three", passed=False)]
    )

    final_rc, _, report = _run_gate(tmp_path, first, retry_cap=2)

    assert final_rc == gate.EXIT_BREACH
    assert "TOO MANY FAILURES TO CONFIRM" in report.read_text()


def test_evaluator_error_on_initial_run_is_unmeasurable_not_a_pass() -> None:
    """A code evaluator that raises is a defect in the scoring apparatus, not
    per-example noise, so it must fail closed even when another example passes
    the same evaluator -- never silently excluded into a green PASSED."""
    decision = gate.decide(
        _artifact(
            [
                _row("pass", passed=True),
                _row("boom", passed=False, evaluator_error="KeyError: 'tool_calls'"),
            ]
        ),
        _policy(),
    )

    assert decision.exit_code == gate.EXIT_INVALID
    assert decision.label == "UNMEASURABLE"
    assert any("evaluator error" in error for error in decision.errors)


def test_confirmed_miss_within_tolerated_threshold_is_surfaced_not_silent_pass() -> None:
    """When a miss reproduces on both attempts but a sub-1.0 override tolerates
    it, the cell does not breach -- but the result must not read as a bare
    PASSED. It gets a distinct outcome so the reproduced miss is visible."""
    first = _artifact([_row("pass", passed=True), _row("fail", passed=False)])
    retry = _artifact([_row("fail", passed=False, explanation="still missing tool")])

    decision = gate.decide(first, _policy(0.5), retry=retry)

    assert decision.exit_code == gate.EXIT_OK
    assert decision.kind == "tolerated"
    assert decision.label == "PASSED WITH TOLERATED MISSES"
    assert len(decision.confirmed) == 1


def test_planning_and_reconciliation_modes_are_mutually_exclusive() -> None:
    """Passing both --retry-nodeids-out and --retry-artifact used to silently
    run planning and ignore the retry artifact; it must now be a hard error."""
    with pytest.raises(SystemExit):
        gate.main(
            [
                "artifact.json",
                "--retry-nodeids-out",
                "nodeids.txt",
                "--retry-artifact",
                "retry.json",
            ]
        )


def test_decision_out_writes_structured_summary(tmp_path: Path) -> None:
    """The machine-readable decision file is the stable contract for the CI
    workflow -- it carries the kind token, label, and exit code so consumers
    never parse the Markdown digest."""
    first = _artifact([_row("broken", passed=False, explanation="missing tool")])
    retry = _artifact([_row("broken", passed=False, explanation="still missing tool")])
    initial_path = tmp_path / "initial.json"
    initial_path.write_text(json.dumps(first))
    retry_path = tmp_path / "retry.json"
    retry_path.write_text(json.dumps(retry))
    thresholds = tmp_path / "thresholds.yaml"
    _write_policy(thresholds)
    decision_out = tmp_path / "decision.json"

    rc = gate.main(
        [
            str(initial_path),
            "--thresholds",
            str(thresholds),
            "--retry-artifact",
            str(retry_path),
            "--decision-out",
            str(decision_out),
        ]
    )

    summary = json.loads(decision_out.read_text())
    assert rc == gate.EXIT_BREACH
    assert summary["kind"] == "regression"
    assert summary["label"] == "CONFIRMED REGRESSION"
    assert summary["exit_code"] == gate.EXIT_BREACH
    assert summary["counts"]["confirmed"] == 1
    assert summary["counts"]["breached_cells"] == 1


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

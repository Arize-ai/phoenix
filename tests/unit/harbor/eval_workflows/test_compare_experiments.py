from __future__ import annotations

import json
import runpy
from pathlib import Path
from typing import Any

import pytest

from harbor_verifiers import grading, verify

TASKS_DIR = (
    Path(__file__).resolve().parents[4]
    / "evals"
    / "harbor"
    / "datasets"
    / "eval-workflows"
    / "tasks"
)


@pytest.mark.parametrize("task", ["compare-experiments", "compare-experiments-ship"])
@pytest.mark.parametrize(
    ("readings", "passes"),
    [
        (("every_run", "cases_passing_all_3"), True),
        (("every_run_except_errored",), True),
        (("cases_passing_all_3_except_errored_case",), True),
        (("mixed",), False),
    ],
)
def test_comparison_requires_one_complete_counting_method(
    task: str, readings: tuple[str, ...], passes: bool, monkeypatch: pytest.MonkeyPatch
) -> None:
    tests = TASKS_DIR / task / "tests"
    expected = json.loads((tests / "expected.json").read_text())
    rates = expected["accepted_pass_rates"]
    recommendation = "Ship v8." if expected["decision"] == "ship" else "Hold v8."
    lines = [recommendation]
    claims: dict[str, Any] = {
        "decision": {"value": expected["decision"], "quote": recommendation, "contradicted": False},
    }
    for reading in readings:
        for name in rates["every_run"]:
            method = reading.split("_except_", 1)[0]
            if reading == "mixed":
                method = "cases_passing_all_3" if "safety" in name else "every_run"
            value = rates[method if reading == "mixed" else reading][name]
            quote = f"{reading} {name}: {value:.1%}"
            lines.append(quote)
            claims[f"{method}_{name}"] = {"value": value, "quote": quote, "contradicted": False}

    reply = "\n".join(lines)

    def extract(text: str, fields: dict[str, str]) -> dict[str, Any]:
        assert text == reply
        assert claims.keys() <= fields.keys()
        assert "separate runs" in fields["every_run_v7_safety_pass_rate"]
        assert "all its repetitions passed" in fields["cases_passing_all_3_v7_safety_pass_rate"]
        return claims

    monkeypatch.setattr(verify, "read_reply", lambda *_: (reply, "trajectory"))
    monkeypatch.setattr(grading, "TESTS_DIR", tests)
    monkeypatch.setattr(grading, "extract_report_claims", extract)
    monkeypatch.setattr(grading, "finish", lambda *_: None)

    result = runpy.run_path(str(tests / "test.py"))

    assert result["checks"] == {"decision": True, "numbers": passes}

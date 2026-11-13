"""Offline tests for the shared `phoenix-evals` grading helpers."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import pytest

from harbor_verifiers import evals_state, grading
from harbor_verifiers.grading import Prediction


@pytest.mark.parametrize(
    ("label", "score", "expected"),
    [
        ("pass", None, True),
        ("FAIL", None, False),
        ("Not Grounded", None, False),
        ("no-pii", None, True),
        (None, 1.0, True),
        (None, 0, False),
        ("needs work", 0.0, False),
        ("needs work", None, None),
        (None, None, None),
        ("", float("nan"), None),
    ],
)
def test_to_bool_reads_meaning_not_agreement(label: Any, score: Any, expected: bool | None) -> None:
    assert grading.to_bool(label, score) is expected


def _prediction(value: bool | None) -> Prediction:
    return Prediction(value, None, None, "LLM", "2026-11-12T00:00:00")


def test_constant_label_fails_one_class() -> None:
    truth = {f"t{i}": i % 3 != 0 for i in range(30)}
    constant = {unit: _prediction(True) for unit in truth}
    result = grading.agreement(constant, truth)
    assert result.good_recall == 1.0 and result.bad_recall == 0.0
    assert not result.passes(0.8)


def test_missing_and_unclear_predictions_count_as_wrong() -> None:
    truth = {"a": True, "b": False, "c": True, "d": False}
    predictions = {"a": _prediction(True), "b": _prediction(None), "c": _prediction(True)}
    result = grading.agreement(predictions, truth)
    assert result.coverage == 0.5
    assert result.bad_recall == 0.0
    assert not result.passes(0.5, min_coverage=0.9)


def test_latest_annotation_wins() -> None:
    rows = [
        (
            "t1",
            {"result": {"label": "pass"}, "annotator_kind": "LLM", "updated_at": "2026-11-12T01"},
        ),
        (
            "t1",
            {"result": {"label": "fail"}, "annotator_kind": "LLM", "updated_at": "2026-11-12T02"},
        ),
    ]
    assert grading._latest(rows)["t1"].value is False


def test_trace_predictions_map_span_annotations_to_traces(monkeypatch: pytest.MonkeyPatch) -> None:
    spans = [
        {"context": {"span_id": "root", "trace_id": "t1"}, "attributes": {}},
        {"context": {"span_id": "child", "trace_id": "t1"}, "attributes": {}},
        {"context": {"span_id": "other", "trace_id": "t2"}, "attributes": {}},
    ]

    def fake_paginate(path: str, params: dict[str, Any]) -> list[dict[str, Any]]:
        if path.endswith("/span_annotations"):
            return [
                {"name": "grounded", "span_id": "child", "result": {"label": "fail"}},
                {"name": "other", "span_id": "other", "result": {"label": "pass"}},
            ]
        return [{"name": "grounded", "trace_id": "t2", "result": {"score": 1}}]

    monkeypatch.setattr(evals_state, "_paginate", fake_paginate)
    predictions = grading.trace_predictions("p", "grounded", spans)
    assert predictions["t1"].value is False
    assert predictions["t2"].value is True


def test_shift_to_now_keeps_order_and_spacing() -> None:
    spans = [
        {"start_time": "2026-11-01T00:00:00+00:00", "end_time": "2026-11-01T00:00:05+00:00"},
        {"start_time": "2026-11-01T01:00:00+00:00", "end_time": "2026-11-01T01:00:02+00:00"},
    ]
    now = datetime(2026, 12, 1, tzinfo=timezone.utc)
    shifted = grading.shift_to_now(spans, end=now)
    first, last = (datetime.fromisoformat(s["start_time"]) for s in shifted)
    assert (last - first).total_seconds() == 3600
    assert datetime.fromisoformat(shifted[1]["end_time"]) < now


REPLY = "Don't turn it on yet. It caught 60% of unsafe replies (recall 0.60), precision 75%."


@pytest.mark.parametrize(
    ("claims", "passed"),
    [
        ({"value": 0.6, "quote": "recall 0.60", "contradicted": False}, True),
        ({"value": "60%", "quote": "caught 60% of unsafe replies", "contradicted": False}, True),
        ({"value": 60, "quote": "caught 60% of unsafe replies", "contradicted": False}, True),
        ({"value": 0.6, "quote": "recall is 0.60", "contradicted": False}, False),
        ({"value": 0.6, "quote": "precision 0.6", "contradicted": False}, False),
        ({"value": 0.6, "quote": "recall 0.60", "contradicted": True}, False),
        ({"value": 0.7, "quote": "recall 0.60", "contradicted": False}, False),
        ({"value": None, "quote": "", "contradicted": False}, False),
    ],
)
def test_report_claims_need_a_real_quote_and_value(claims: dict[str, Any], passed: bool) -> None:
    checks = grading.check_report_claims({"recall": claims}, {"recall": 0.6}, REPLY)
    assert checks["recall"] is passed


def test_percent_strings_and_decisions() -> None:
    claims = {
        "recall": {"value": "0.6", "quote": "recall 0.60", "contradicted": False},
        "decision": {
            "value": "Dont_Turn_On",
            "quote": "Don't turn it on yet",
            "contradicted": False,
        },
    }
    checks = grading.check_report_claims(claims, {"recall": 0.6, "decision": "dont_turn_on"}, REPLY)
    assert checks == {"recall": True, "decision": True}


def test_stitched_quote_from_one_line_is_accepted() -> None:
    reply = "Safety cases: v7 passed 11 of 12; v8 passed 9 of 12 (75%)."
    claim = {"value": 0.75, "quote": "Safety cases: v8 passed 9 of 12 (75%)", "contradicted": False}
    assert grading.check_report_claims({"v8": claim}, {"v8": 0.75}, reply) == {"v8": True}


def test_quote_scattered_across_the_reply_is_rejected() -> None:
    reply = "Recall " + "filler words here " * 20 + "was 0.6 overall."
    claim = {"value": 0.6, "quote": "Recall was 0.6", "contradicted": False}
    assert grading.check_report_claims({"r": claim}, {"r": 0.6}, reply) == {"r": False}

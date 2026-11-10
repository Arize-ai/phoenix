"""Controls for the two verifiers that grade annotations on production traces."""

from __future__ import annotations

from typing import Any

import pytest

from harbor_verifiers.evals_state import TraceAnnotation

from .fakes import Recorder, load_check

grounding = load_check("grounding-on-production", "check_grounding")
builtin = load_check("builtin-or-custom", "check_builtin_or_custom")

UNGROUNDED = set(grounding.TRUTH["ungrounded_traces"])
TRACES = sorted(
    UNGROUNDED | set(grounding.TRUTH["grounded_traces"]) | set(grounding.TRUTH["excluded_traces"])
)
AMOUNTS = {TRACES[0]: "Total $57.40.", TRACES[1]: "Refund of $84.99."}


def _spans() -> list[dict[str, Any]]:
    spans = []
    for i, trace in enumerate(TRACES):
        output = AMOUNTS.get(trace, "Here is how to do that.")
        for kind in ("CHAIN", "LLM"):
            spans.append(
                {
                    "context": {"trace_id": trace, "span_id": f"{kind}{i}"},
                    "span_kind": kind,
                    "attributes": {"output.value": output},
                }
            )
    return spans


def _ann(
    trace: str,
    name: str,
    label: str | None,
    kind: str = "LLM",
    unit: str = "span",
    explanation: str | None = "why",
) -> TraceAnnotation:
    return TraceAnnotation(
        trace, unit, "LLM" if unit == "span" else None, name, kind, label, None, explanation
    )


def _run(
    monkeypatch: pytest.MonkeyPatch, module: Any, annotations: list[TraceAnnotation]
) -> Recorder:
    recorder = Recorder()
    monkeypatch.setattr(module, "project_spans", lambda project: _spans())
    monkeypatch.setattr(module, "trace_level_annotations", lambda project, spans: annotations)
    monkeypatch.setattr(module, "write_reward", recorder)
    module.main()
    return recorder


def test_grounding_labels_on_every_trace_pass(monkeypatch: pytest.MonkeyPatch) -> None:
    annotations = [
        _ann(t, "hallucination", "hallucinated" if t in UNGROUNDED else "grounded") for t in TRACES
    ]
    result = _run(monkeypatch, grounding, annotations)
    assert result.reward == 1.0
    assert result.scores["diag_builtin_used"] == 1.0
    assert result.scores["diag_hidden_agreement"] == 1.0


def test_grounding_trace_level_annotations_pass(monkeypatch: pytest.MonkeyPatch) -> None:
    annotations = [_ann(t, "support", "ok", unit="trace") for t in TRACES]
    assert _run(monkeypatch, grounding, annotations).reward == 1.0


def test_grounding_missing_traces_fail(monkeypatch: pytest.MonkeyPatch) -> None:
    annotations = [_ann(t, "hallucination", "grounded") for t in TRACES[:5]]
    assert _run(monkeypatch, grounding, annotations).reward == 0.0


def test_grounding_free_text_labels_fail(monkeypatch: pytest.MonkeyPatch) -> None:
    annotations = [_ann(t, "notes", f"reason {i}") for i, t in enumerate(TRACES)]
    assert _run(monkeypatch, grounding, annotations).reward == 0.0


def _amount_label(trace: str) -> str:
    return "yes" if trace in AMOUNTS else "no"


def test_two_dimensions_with_correct_amount_check_pass(monkeypatch: pytest.MonkeyPatch) -> None:
    annotations = [_ann(t, "dollar_check", _amount_label(t), kind="CODE") for t in TRACES]
    annotations += [_ann(t, "user_friction", "no_friction") for t in TRACES]
    result = _run(monkeypatch, builtin, annotations)
    assert result.reward == 1.0, result.details
    assert result.scores["practice_amount_check_is_code"] == 1.0
    assert result.scores["diag_builtin_used"] == 1.0


def test_one_combined_annotation_fails(monkeypatch: pytest.MonkeyPatch) -> None:
    annotations = [_ann(t, "combined", f"amount={_amount_label(t)};friction=no") for t in TRACES]
    assert _run(monkeypatch, builtin, annotations).reward == 0.0


def test_wrong_amount_check_fails(monkeypatch: pytest.MonkeyPatch) -> None:
    annotations = [_ann(t, "dollar_check", "no", kind="CODE") for t in TRACES]
    annotations += [_ann(t, "frustration", "calm") for t in TRACES]
    assert _run(monkeypatch, builtin, annotations).reward == 0.0

from __future__ import annotations

from dataclasses import replace
from datetime import datetime, timezone
from typing import Any

from phoenix.client.__generated__ import v1

from evals.pxi.offline_evals.evaluators.tool_count_per_turn import TOOL_COUNT_PER_TURN
from evals.pxi.offline_evals.run import _sampled, run_evaluators


def _span(
    span_id: str,
    *,
    trace_id: str,
    name: str,
    kind: str,
    parent_id: str | None,
) -> v1.Span:
    span: v1.Span = {
        "name": name,
        "context": {"trace_id": trace_id, "span_id": span_id},
        "span_kind": kind,
        "start_time": "2026-07-09T00:00:00+00:00",
        "end_time": "2026-07-09T00:01:00+00:00",
        "status_code": "OK",
    }
    if parent_id is not None:
        span["parent_id"] = parent_id
    return span


class _FakeSpans:
    def __init__(
        self,
        roots: list[v1.Span],
        traces: dict[str, list[v1.Span]],
        annotations: list[v1.SpanAnnotation],
    ) -> None:
        self.roots = roots
        self.traces = traces
        self.annotations = annotations
        self.hydrated_trace_ids: list[str] = []
        self.writes: list[v1.SpanAnnotationData] = []

    def get_spans(self, **kwargs: Any) -> list[v1.Span]:
        if trace_ids := kwargs.get("trace_ids"):
            self.hydrated_trace_ids.extend(trace_ids)
            return [span for trace_id in trace_ids for span in self.traces[trace_id]]
        return self.roots

    def get_span_annotations(self, **_: Any) -> list[v1.SpanAnnotation]:
        return self.annotations

    def log_span_annotations(
        self, *, span_annotations: list[v1.SpanAnnotationData], sync: bool
    ) -> list[dict[str, str]]:
        assert sync is True
        self.writes.extend(span_annotations)
        return [{"id": str(index)} for index, _ in enumerate(span_annotations)]


class _FakeClient:
    def __init__(self, spans: _FakeSpans) -> None:
        self.spans = spans


def _existing(span_id: str, *, identifier: str = "pxi-offline-evals") -> v1.SpanAnnotation:
    return {
        "id": "annotation-1",
        "name": "tool_count_per_turn",
        "annotator_kind": "CODE",
        "span_id": span_id,
        "identifier": identifier,
        "result": {"score": 1.0},
        "created_at": "2026-07-09T00:00:00+00:00",
        "updated_at": "2026-07-09T00:00:00+00:00",
        "source": "API",
        "user_id": None,
    }


def test_filters_existing_annotations_before_hydrating_traces() -> None:
    old_root = _span(
        "old-root", trace_id="old-trace", name="pxi.turn", kind="AGENT", parent_id=None
    )
    new_root = _span(
        "new-root", trace_id="new-trace", name="pxi.turn", kind="AGENT", parent_id=None
    )
    new_tool = _span(
        "new-tool", trace_id="new-trace", name="bash", kind="TOOL", parent_id="new-root"
    )
    spans = _FakeSpans(
        [old_root, new_root],
        {"old-trace": [old_root], "new-trace": [new_root, new_tool]},
        [_existing("old-root")],
    )

    summary = run_evaluators(
        _FakeClient(spans),  # type: ignore[arg-type]
        project="pxi_dev",
        specs=[TOOL_COUNT_PER_TURN],
        now=datetime(2026, 7, 9, 2, tzinfo=timezone.utc),
    )["tool_count_per_turn"]

    assert spans.hydrated_trace_ids == ["new-trace"]
    assert summary.discovered == 2
    assert summary.already_annotated == 1
    assert summary.evaluated == 1
    assert summary.annotations == 1
    assert spans.writes == [
        {
            "name": "tool_count_per_turn",
            "annotator_kind": "CODE",
            "span_id": "new-root",
            "identifier": "pxi-offline-evals",
            "result": {
                "score": 1.0,
                "explanation": "1 top-level PXI tool call in this turn",
            },
            "metadata": {"tool_names": ["bash"]},
        }
    ]


def test_different_identifier_does_not_suppress_evaluator() -> None:
    root = _span("root", trace_id="trace", name="pxi.turn", kind="AGENT", parent_id=None)
    spans = _FakeSpans([root], {"trace": [root]}, [_existing("root", identifier="other")])

    summary = run_evaluators(
        _FakeClient(spans),  # type: ignore[arg-type]
        project="pxi_dev",
        specs=[TOOL_COUNT_PER_TURN],
        now=datetime(2026, 7, 9, 2, tzinfo=timezone.utc),
        dry_run=True,
    )["tool_count_per_turn"]

    assert summary.already_annotated == 0
    assert summary.evaluated == 1
    assert summary.annotations == 1
    assert spans.writes == []


def test_sampling_is_deterministic() -> None:
    sampled_spec = TOOL_COUNT_PER_TURN.__class__(
        name="sampled",
        target="trace",
        root_span_name="pxi.turn",
        evaluate=TOOL_COUNT_PER_TURN.evaluate,
        sample_rate=0.5,
    )
    assert _sampled(sampled_spec, "trace-1") == _sampled(sampled_spec, "trace-1")
    assert any(_sampled(sampled_spec, f"trace-{index}") for index in range(100))
    assert any(not _sampled(sampled_spec, f"trace-{index}") for index in range(100))


def test_applicability_filter_skips_evaluation() -> None:
    root = _span("root", trace_id="trace", name="pxi.turn", kind="AGENT", parent_id=None)
    spans = _FakeSpans([root], {"trace": [root]}, [])
    spec = replace(TOOL_COUNT_PER_TURN, applies_to=lambda _root, _spans: False)

    summary = run_evaluators(
        _FakeClient(spans),  # type: ignore[arg-type]
        project="pxi_dev",
        specs=[spec],
        now=datetime(2026, 7, 9, 2, tzinfo=timezone.utc),
    )["tool_count_per_turn"]

    assert summary.not_applicable == 1
    assert summary.evaluated == 0
    assert spans.writes == []

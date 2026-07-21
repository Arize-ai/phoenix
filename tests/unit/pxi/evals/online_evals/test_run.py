from __future__ import annotations

import asyncio
from dataclasses import replace
from datetime import datetime, timezone
from typing import Any
from unittest import mock

import pytest
from phoenix.client.__generated__ import v1
from phoenix.evals.evaluators import Score

from evals.pxi.online_evals import run as run_module
from evals.pxi.online_evals.evaluators.tool_count_per_turn import TOOL_COUNT_PER_TURN
from evals.pxi.online_evals.models import RunSummary
from evals.pxi.online_evals.run import _fetch_batch_spans, _sampled, run_evaluators


def _run(*args: Any, **kwargs: Any) -> dict[str, RunSummary]:
    return asyncio.run(run_evaluators(*args, **kwargs))


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
        self.write_batches: list[list[v1.SpanAnnotationData]] = []
        self.get_spans_calls = 0
        self.get_spans_requests: list[dict[str, Any]] = []

    def get_spans(self, **kwargs: Any) -> list[v1.Span]:
        self.get_spans_calls += 1
        self.get_spans_requests.append(kwargs)
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
        self.write_batches.append(list(span_annotations))
        return [{"id": str(index)} for index, _ in enumerate(span_annotations)]


class _FakeClient:
    def __init__(self, spans: _FakeSpans) -> None:
        self.spans = spans


class _BatchFakeSpans:
    def __init__(self, traces: dict[str, list[v1.Span]]) -> None:
        self.traces = traces
        self.requests: list[list[str]] = []

    def get_spans(self, **kwargs: Any) -> list[v1.Span]:
        trace_ids = kwargs["trace_ids"]
        self.requests.append(trace_ids)
        return [span for trace_id in trace_ids for span in self.traces[trace_id]]


def _existing(
    span_id: str,
    *,
    identifier: str = "pxi-online-evals:tool-count-per-turn:v1",
) -> v1.SpanAnnotation:
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


def test_fetch_batch_spans_splits_an_exactly_full_multi_trace_response() -> None:
    first_root = _span("a-root", trace_id="a", name="pxi.turn", kind="AGENT", parent_id=None)
    first_tool = _span("a-tool", trace_id="a", name="bash", kind="TOOL", parent_id="a-root")
    second_root = _span("b-root", trace_id="b", name="pxi.turn", kind="AGENT", parent_id=None)
    second_tool = _span("b-tool", trace_id="b", name="bash", kind="TOOL", parent_id="b-root")
    spans = _BatchFakeSpans({"a": [first_root, first_tool], "b": [second_root, second_tool]})

    with mock.patch.object(run_module, "MAX_SPANS_PER_BATCH", 4):
        fetched = _fetch_batch_spans(
            _FakeClient(spans),  # type: ignore[arg-type]
            project="pxi_dev",
            batch=["a", "b"],
        )

    assert spans.requests == [["a", "b"], ["a"], ["b"]]
    assert [span["context"]["span_id"] for span in fetched] == [
        "a-root",
        "a-tool",
        "b-root",
        "b-tool",
    ]


def test_fetch_batch_spans_rejects_one_trace_at_the_safety_limit() -> None:
    traces = {
        "oversized": [
            _span(
                f"span-{index}",
                trace_id="oversized",
                name="pxi.turn" if index == 0 else "bash",
                kind="AGENT" if index == 0 else "TOOL",
                parent_id=None if index == 0 else "span-0",
            )
            for index in range(4)
        ]
    }
    spans = _BatchFakeSpans(traces)

    with (
        mock.patch.object(run_module, "MAX_SPANS_PER_BATCH", 4),
        pytest.raises(RuntimeError, match="trace oversized alone reached the span safety limit"),
    ):
        _fetch_batch_spans(
            _FakeClient(spans),  # type: ignore[arg-type]
            project="pxi_dev",
            batch=["oversized"],
        )

    assert spans.requests == [["oversized"]]


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

    summary = _run(
        _FakeClient(spans),
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
            "identifier": "pxi-online-evals:tool-count-per-turn:v1",
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

    summary = _run(
        _FakeClient(spans),
        project="pxi_dev",
        specs=[TOOL_COUNT_PER_TURN],
        now=datetime(2026, 7, 9, 2, tzinfo=timezone.utc),
        dry_run=True,
    )["tool_count_per_turn"]

    assert summary.already_annotated == 0
    assert summary.evaluated == 1
    assert summary.annotations == 1
    assert spans.writes == []


def test_settle_delay_uses_root_completion_time() -> None:
    settled_root = _span(
        "settled-root", trace_id="settled-trace", name="pxi.turn", kind="AGENT", parent_id=None
    )
    recent_root = _span(
        "recent-root", trace_id="recent-trace", name="pxi.turn", kind="AGENT", parent_id=None
    )
    settled_root["end_time"] = "2026-07-09T01:54:00+00:00"
    recent_root["end_time"] = "2026-07-09T01:59:00+00:00"
    spans = _FakeSpans(
        [settled_root, recent_root],
        {"settled-trace": [settled_root], "recent-trace": [recent_root]},
        [],
    )
    current = datetime(2026, 7, 9, 2, tzinfo=timezone.utc)

    summary = _run(
        _FakeClient(spans),
        project="pxi_dev",
        specs=[TOOL_COUNT_PER_TURN],
        now=current,
    )["tool_count_per_turn"]

    assert spans.get_spans_requests[0]["end_time"] == current
    assert spans.hydrated_trace_ids == ["settled-trace"]
    assert summary.discovered == 1
    assert summary.evaluated == 1


def test_serializes_categorical_label_as_annotation_result() -> None:
    root = _span("root", trace_id="trace", name="pxi.turn", kind="AGENT", parent_id=None)
    spans = _FakeSpans([root], {"trace": [root]}, [])

    async def categorical(_root: v1.Span, _spans: Any) -> Score:
        return Score(score=1.0, label="friction", metadata={"provider": "openai"})

    spec = replace(TOOL_COUNT_PER_TURN, name="categorical", evaluate=categorical)

    _run(
        _FakeClient(spans),
        project="pxi_dev",
        specs=[spec],
        now=datetime(2026, 7, 9, 2, tzinfo=timezone.utc),
    )

    assert spans.writes == [
        {
            "name": "categorical",
            "annotator_kind": "CODE",
            "span_id": "root",
            "identifier": "pxi-online-evals:tool-count-per-turn:v1",
            "result": {"score": 1.0, "label": "friction"},
            "metadata": {"provider": "openai"},
        }
    ]


def test_flushes_annotations_in_bounded_batches() -> None:
    roots = [
        _span(
            f"root-{index}",
            trace_id=f"trace-{index}",
            name="pxi.turn",
            kind="AGENT",
            parent_id=None,
        )
        for index in range(3)
    ]
    spans = _FakeSpans(roots, {f"trace-{index}": [root] for index, root in enumerate(roots)}, [])

    with mock.patch.object(run_module, "ANNOTATION_WRITE_BATCH_SIZE", 2):
        summary = _run(
            _FakeClient(spans),
            project="pxi_dev",
            specs=[TOOL_COUNT_PER_TURN],
            now=datetime(2026, 7, 9, 2, tzinfo=timezone.utc),
        )["tool_count_per_turn"]

    assert [len(batch) for batch in spans.write_batches] == [2, 1]
    assert summary.annotations == 3


def test_llm_identifier_embeds_the_shared_judge_provider_and_model() -> None:
    root = _span("root", trace_id="trace", name="pxi.turn", kind="AGENT", parent_id=None)
    spans = _FakeSpans([root], {"trace": [root]}, [])
    spec = replace(TOOL_COUNT_PER_TURN, name="llm_eval", annotator_kind="LLM")

    with mock.patch.dict(
        "os.environ",
        {
            "PHOENIX_AGENTS_EVALS_PROVIDER": "anthropic",
            "PHOENIX_AGENTS_EVALS_MODEL": "claude-test",
            "ANTHROPIC_API_KEY": "test-key",
        },
    ):
        _run(
            _FakeClient(spans),
            project="pxi_dev",
            specs=[spec],
            now=datetime(2026, 7, 9, 2, tzinfo=timezone.utc),
        )

    assert [annotation["identifier"] for annotation in spans.writes] == [
        "pxi-online-evals:tool-count-per-turn:v1:anthropic:claude-test"
    ]


def test_evaluations_run_concurrently() -> None:
    """Two pending evaluations must overlap: the first blocks until the second
    starts, which deadlocks if the runner awaits evaluations sequentially."""
    roots = [
        _span(f"root-{i}", trace_id=f"trace-{i}", name="pxi.turn", kind="AGENT", parent_id=None)
        for i in range(2)
    ]
    spans = _FakeSpans(roots, {f"trace-{i}": [root] for i, root in enumerate(roots)}, [])
    started = asyncio.Event()

    async def rendezvous(root: v1.Span, _spans: Any) -> Score:
        if root["context"]["span_id"] == "root-0":
            await asyncio.wait_for(started.wait(), timeout=5)
        else:
            started.set()
        return Score(score=1.0)

    spec = replace(TOOL_COUNT_PER_TURN, evaluate=rendezvous)
    summary = _run(
        _FakeClient(spans),
        project="pxi_dev",
        specs=[spec],
        now=datetime(2026, 7, 9, 2, tzinfo=timezone.utc),
    )["tool_count_per_turn"]

    assert summary.evaluated == 2


@pytest.mark.parametrize(
    ("name", "artifact_id", "sample_rate", "expected"),
    [
        ("sampled", "trace-1", 0.5, True),
        ("sampled", "trace-2", 0.5, False),
        ("user_friction", "abc", 0.25, False),
        ("user_friction", "xyz", 0.25, True),
        ("sampled", "trace-1", 0.0, False),
        ("sampled", "trace-1", 1.0, True),
    ],
)
def test_sampling_is_deterministic_across_runs(
    name: str,
    artifact_id: str,
    sample_rate: float,
    expected: bool,
) -> None:
    spec = replace(TOOL_COUNT_PER_TURN, name=name, sample_rate=sample_rate)
    assert _sampled(spec, artifact_id) is expected


def test_sampling_is_consistent_across_evaluators() -> None:
    """Evaluators sample by trace, not by (evaluator, trace).

    Equal rates select identical traces; a lower rate selects a strict subset
    of a higher rate — so sampled traces are never partially annotated.
    """
    trace_ids = [f"trace-{i}" for i in range(200)]
    first = replace(TOOL_COUNT_PER_TURN, name="first", sample_rate=0.5)
    second = replace(TOOL_COUNT_PER_TURN, name="second", sample_rate=0.5)
    narrow = replace(TOOL_COUNT_PER_TURN, name="narrow", sample_rate=0.25)

    selected_first = {tid for tid in trace_ids if _sampled(first, tid)}
    selected_second = {tid for tid in trace_ids if _sampled(second, tid)}
    selected_narrow = {tid for tid in trace_ids if _sampled(narrow, tid)}

    assert selected_first == selected_second
    assert selected_narrow <= selected_first
    assert 0 < len(selected_narrow) < len(selected_first) < len(trace_ids)


def test_none_result_counts_as_not_applicable() -> None:
    root = _span("root", trace_id="trace", name="pxi.turn", kind="AGENT", parent_id=None)
    spans = _FakeSpans([root], {"trace": [root]}, [])

    async def not_applicable(_root: v1.Span, _spans: Any) -> None:
        return None

    spec = replace(TOOL_COUNT_PER_TURN, evaluate=not_applicable)
    summary = _run(
        _FakeClient(spans),
        project="pxi_dev",
        specs=[spec],
        now=datetime(2026, 7, 9, 2, tzinfo=timezone.utc),
    )["tool_count_per_turn"]

    assert summary.not_applicable == 1
    assert summary.evaluated == 0
    assert spans.writes == []


def test_evaluator_failure_is_isolated_to_one_turn() -> None:
    failing_root = _span(
        "failing-root", trace_id="failing-trace", name="pxi.turn", kind="AGENT", parent_id=None
    )
    successful_root = _span(
        "successful-root",
        trace_id="successful-trace",
        name="pxi.turn",
        kind="AGENT",
        parent_id=None,
    )
    successful_tool = _span(
        "successful-tool",
        trace_id="successful-trace",
        name="bash",
        kind="TOOL",
        parent_id="successful-root",
    )
    spans = _FakeSpans(
        [failing_root, successful_root],
        {
            "failing-trace": [failing_root],
            "successful-trace": [successful_root, successful_tool],
        },
        [],
    )

    async def evaluate(root: v1.Span, trace_spans: Any) -> Any:
        if root["context"]["span_id"] == "failing-root":
            raise ValueError("malformed trace")
        return await TOOL_COUNT_PER_TURN.evaluate(root, trace_spans)

    spec = replace(TOOL_COUNT_PER_TURN, evaluate=evaluate)
    summary = _run(
        _FakeClient(spans),
        project="pxi_dev",
        specs=[spec],
        now=datetime(2026, 7, 9, 2, tzinfo=timezone.utc),
    )["tool_count_per_turn"]

    assert summary.errors == 1
    assert summary.evaluated == 1
    assert summary.annotations == 1
    assert [annotation["span_id"] for annotation in spans.writes] == ["successful-root"]


def test_missing_judge_credentials_fail_before_discovery() -> None:
    spans = _FakeSpans([], {}, [])
    spec = replace(TOOL_COUNT_PER_TURN, annotator_kind="LLM")

    with (
        mock.patch.dict("os.environ", {}, clear=True),
        pytest.raises(RuntimeError, match="OPENAI_API_KEY"),
    ):
        _run(
            _FakeClient(spans),
            project="pxi_dev",
            specs=[spec],
        )

    assert spans.get_spans_calls == 0


def test_unknown_judge_provider_fails_before_discovery() -> None:
    spans = _FakeSpans([], {}, [])
    spec = replace(TOOL_COUNT_PER_TURN, annotator_kind="LLM")

    with (
        mock.patch.dict("os.environ", {"PHOENIX_AGENTS_EVALS_PROVIDER": "opneai"}, clear=True),
        pytest.raises(
            ValueError,
            match=(
                "unsupported PHOENIX_AGENTS_EVALS_PROVIDER 'opneai'; expected one of: "
                "anthropic, google, openai"
            ),
        ),
    ):
        _run(
            _FakeClient(spans),
            project="pxi_dev",
            specs=[spec],
        )

    assert spans.get_spans_calls == 0


def test_code_evaluators_require_no_judge_credentials() -> None:
    root = _span("root", trace_id="trace", name="pxi.turn", kind="AGENT", parent_id=None)
    spans = _FakeSpans([root], {"trace": [root]}, [])

    with mock.patch.dict("os.environ", {}, clear=True):
        summary = _run(
            _FakeClient(spans),
            project="pxi_dev",
            specs=[TOOL_COUNT_PER_TURN],
            now=datetime(2026, 7, 9, 2, tzinfo=timezone.utc),
        )["tool_count_per_turn"]

    assert summary.evaluated == 1


def test_main_returns_nonzero_when_an_evaluator_errors() -> None:
    with (
        mock.patch.object(run_module, "Client"),
        mock.patch.object(
            run_module,
            "run_evaluators",
            new=mock.AsyncMock(return_value={"tool_count_per_turn": RunSummary(errors=1)}),
        ),
    ):
        assert run_module.main(["--eval", "tool_count_per_turn"]) == 1


@pytest.mark.parametrize("value", ["0", "-1", "nan", "inf", "not-a-number"])
def test_time_window_flags_require_positive_finite_values(value: str) -> None:
    with pytest.raises(SystemExit, match="2"):
        run_module.build_arg_parser().parse_args(["--lookback-hours", value])


def test_lookback_must_exceed_settle_delay(capsys: pytest.CaptureFixture[str]) -> None:
    with pytest.raises(SystemExit, match="2"):
        run_module.main(["--lookback-hours", "1", "--settle-minutes", "60"])

    assert "--lookback-hours must cover more time than --settle-minutes" in capsys.readouterr().err

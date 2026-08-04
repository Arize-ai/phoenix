from __future__ import annotations

import asyncio
import json
from dataclasses import replace
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from unittest import mock

import pytest

from evals.pxi.online_evals import run as run_module
from evals.pxi.online_evals.evaluators.suggestion_accepted import (
    APPROVAL_DECISION_ATTRIBUTE,
    APPROVAL_SOURCE_ATTRIBUTE,
    SUGGESTION_ACCEPTED,
)
from evals.pxi.online_evals.evaluators.tool_count_per_turn import TOOL_COUNT_PER_TURN
from evals.pxi.online_evals.models import EvaluatorSpec, RunSummary, SpanSelector
from evals.pxi.online_evals.run import _fetch_batch_spans, _sampled, run_evaluators
from phoenix.client.__generated__ import v1
from phoenix.evals.evaluators import Score


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
        candidates: list[v1.Span],
        traces: dict[str, list[v1.Span]],
        annotations: list[v1.SpanAnnotation],
    ) -> None:
        self.candidates = candidates
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
        # Discovery: apply the same filters the server would, so a test with
        # two selectors sees each query return only its own candidates.
        names = kwargs.get("name")
        kinds = kwargs.get("span_kind")
        parent_id = kwargs.get("parent_id")
        attributes: dict[str, str] = kwargs.get("attributes") or {}
        return [
            span
            for span in self.candidates
            if (names is None or span["name"] in names)
            and (kinds is None or span["span_kind"] in kinds)
            and (parent_id != "null" or span.get("parent_id") is None)
            and all(
                span.get("attributes", {}).get(key) == value for key, value in attributes.items()
            )
        ]

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
    identifier: str = "pxi-online-evals:tool-count-per-turn:v2",
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


def test_oversized_trace_does_not_prevent_other_traces_from_being_evaluated() -> None:
    oversized_root = _span(
        "oversized-root",
        trace_id="oversized",
        name="pxi.turn",
        kind="AGENT",
        parent_id=None,
    )
    oversized_trace = [
        oversized_root,
        *[
            _span(
                f"oversized-{index}",
                trace_id="oversized",
                name="bash",
                kind="TOOL",
                parent_id="oversized-root",
            )
            for index in range(3)
        ],
    ]
    healthy_root = _span(
        "healthy-root", trace_id="healthy", name="pxi.turn", kind="AGENT", parent_id=None
    )
    healthy_tool = _span(
        "healthy-tool", trace_id="healthy", name="bash", kind="TOOL", parent_id="healthy-root"
    )
    spans = _FakeSpans(
        [oversized_root, healthy_root],
        {"oversized": oversized_trace, "healthy": [healthy_root, healthy_tool]},
        [],
    )

    with mock.patch.object(run_module, "MAX_SPANS_PER_BATCH", 4):
        summary = _run(
            _FakeClient(spans),
            project="pxi_dev",
            specs=[TOOL_COUNT_PER_TURN],
            now=datetime(2026, 7, 9, 2, tzinfo=timezone.utc),
        )["tool_count_per_turn"]

    assert summary.errors == 1
    assert summary.evaluated == 1
    assert summary.annotations == 1
    assert [annotation["span_id"] for annotation in spans.writes] == ["healthy-root"]


def test_evaluator_spec_requires_explicit_annotator_kind() -> None:
    with pytest.raises(TypeError, match="annotator_kind"):
        EvaluatorSpec(  # type: ignore[call-arg]
            name="ambiguous",
            selector=TOOL_COUNT_PER_TURN.selector,
            evaluate=TOOL_COUNT_PER_TURN.evaluate,
        )


@pytest.mark.parametrize("names", [("",), ("pxi.turn", "")])
def test_span_selector_rejects_empty_span_names(names: tuple[str, ...]) -> None:
    with pytest.raises(ValueError, match="non-empty span names"):
        SpanSelector(names=names)


def test_span_selector_requires_a_bounding_filter() -> None:
    """Without a name or attribute filter, discovery would sweep the whole window."""
    with pytest.raises(ValueError, match="at least one name or attribute"):
        SpanSelector(span_kinds=("TOOL",))


def test_span_selector_matches_on_attributes() -> None:
    selector = SpanSelector(attributes={APPROVAL_SOURCE_ATTRIBUTE: "user"})
    matching = _accepted("matching", trace_id="trace", parent_id="root")
    auto = _approval_tool(
        "auto", trace_id="trace", parent_id="root", decision="accepted", source="auto"
    )
    unmarked = _span("plain", trace_id="trace", name="read_prompt", kind="TOOL", parent_id="root")

    assert selector.matches(matching)
    assert not selector.matches(auto)
    assert not selector.matches(unmarked)


def test_span_selector_matches_a_concrete_parent_id() -> None:
    selector = SpanSelector(names=("tool",), parent_id="expected-parent")
    matching = _span(
        "matching", trace_id="trace", name="tool", kind="TOOL", parent_id="expected-parent"
    )
    sibling = _span("sibling", trace_id="trace", name="tool", kind="TOOL", parent_id="other-parent")

    assert selector.matches(matching)
    assert not selector.matches(sibling)


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
            "identifier": "pxi-online-evals:tool-count-per-turn:v2",
            "result": {
                "score": 1.0,
                "explanation": "1 tool call in this turn",
            },
            "metadata": {
                "tool_names": ["bash"],
                "top_level_tool_names": ["bash"],
                "nested_tool_names": [],
                "nested_tool_count": 0,
                "subagent_call_count": 0,
            },
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
            "identifier": "pxi-online-evals:tool-count-per-turn:v2",
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
        "pxi-online-evals:tool-count-per-turn:v2:anthropic:claude-test"
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
    assert summary.not_applicable_reasons == {"evaluator_not_applicable": 1}
    assert summary.evaluated == 0
    assert spans.writes == []


def test_incomplete_tool_topology_is_not_applicable() -> None:
    root = _span("root", trace_id="trace", name="pxi.turn", kind="AGENT", parent_id=None)
    tool = _span("tool", trace_id="trace", name="bash", kind="TOOL", parent_id="missing")
    spans = _FakeSpans([root], {"trace": [root, tool]}, [])

    summary = _run(
        _FakeClient(spans),
        project="pxi_dev",
        specs=[TOOL_COUNT_PER_TURN],
        now=datetime(2026, 7, 9, 2, tzinfo=timezone.utc),
    )["tool_count_per_turn"]

    assert summary.not_applicable == 1
    assert summary.not_applicable_reasons == {"incomplete_topology": 1}
    assert summary.errors == 0
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
        assert run_module.main(["--project", "pxi_dev", "--eval", "tool_count_per_turn"]) == 1


def test_main_writes_structured_and_github_summaries(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    json_path = tmp_path / "summary.json"
    markdown_path = tmp_path / "step-summary.md"
    monkeypatch.setenv("GITHUB_STEP_SUMMARY", str(markdown_path))
    summary = RunSummary(
        discovered=3,
        already_annotated=1,
        not_applicable=1,
        evaluated=1,
        annotations=1,
        not_applicable_reasons={"incomplete_topology": 1},
    )

    with (
        mock.patch.object(run_module, "Client"),
        mock.patch.object(
            run_module,
            "run_evaluators",
            new=mock.AsyncMock(return_value={"tool_count_per_turn": summary}),
        ),
    ):
        exit_code = run_module.main(
            [
                "--project",
                "pxi_dev",
                "--eval",
                "tool_count_per_turn",
                "--summary-json",
                str(json_path),
            ]
        )

    assert exit_code == 0
    assert json.loads(json_path.read_text()) == {
        "schema_version": 1,
        "status": "succeeded",
        "project": "pxi_dev",
        "dry_run": False,
        "evaluators": {
            "tool_count_per_turn": {
                "discovered": 3,
                "already_annotated": 1,
                "sampled_out": 0,
                "not_applicable": 1,
                "evaluated": 1,
                "errors": 0,
                "annotations": 1,
                "not_applicable_reasons": {"incomplete_topology": 1},
            }
        },
    }
    markdown = markdown_path.read_text()
    assert "**Status:** succeeded" in markdown
    assert "| `tool_count_per_turn` | 3 | 1 | 1 | 1 | 0 | 1 |" in markdown
    assert "`incomplete_topology`=1" in markdown


@pytest.mark.parametrize("value", ["0", "-1", "nan", "inf", "not-a-number"])
def test_time_window_flags_require_positive_finite_values(value: str) -> None:
    with pytest.raises(SystemExit, match="2"):
        run_module.build_arg_parser().parse_args(["--lookback-hours", value])


def test_lookback_must_exceed_settle_delay(capsys: pytest.CaptureFixture[str]) -> None:
    with pytest.raises(SystemExit, match="2"):
        run_module.main(["--project", "pxi_dev", "--lookback-hours", "1", "--settle-minutes", "60"])

    assert "--lookback-hours must cover more time than --settle-minutes" in capsys.readouterr().err


def test_project_is_required_without_project_environment(
    capsys: pytest.CaptureFixture[str],
) -> None:
    with (
        mock.patch.dict("os.environ", {}, clear=True),
        pytest.raises(SystemExit, match="2"),
    ):
        run_module.build_arg_parser().parse_args([])

    assert "--project" in capsys.readouterr().err


@pytest.mark.parametrize("variable", ["PHOENIX_PROJECT", "PHOENIX_PROJECT_NAME"])
def test_project_defaults_from_environment(variable: str) -> None:
    with mock.patch.dict("os.environ", {variable: "configured-project"}, clear=True):
        args = run_module.build_arg_parser().parse_args([])

    assert args.project == "configured-project"


# --- mixed root and TOOL targeting ---------------------------------------


def _approval_tool(
    span_id: str,
    *,
    trace_id: str,
    parent_id: str,
    decision: str,
    source: str = "user",
    name: str = "edit_prompt_instance",
) -> v1.Span:
    span = _span(span_id, trace_id=trace_id, name=name, kind="TOOL", parent_id=parent_id)
    span["attributes"] = {
        "tool.name": name,
        APPROVAL_DECISION_ATTRIBUTE: decision,
        APPROVAL_SOURCE_ATTRIBUTE: source,
    }
    return span


def _accepted(span_id: str, *, trace_id: str, parent_id: str) -> v1.Span:
    return _approval_tool(span_id, trace_id=trace_id, parent_id=parent_id, decision="accepted")


def _rejected(span_id: str, *, trace_id: str, parent_id: str) -> v1.Span:
    return _approval_tool(span_id, trace_id=trace_id, parent_id=parent_id, decision="rejected")


def _discovery_requests(spans: _FakeSpans) -> list[dict[str, Any]]:
    return [request for request in spans.get_spans_requests if "trace_ids" not in request]


def test_both_root_evaluators_share_one_discovery_query() -> None:
    """Identical selectors are grouped, so two turn evaluators cost one query."""
    root = _span("root", trace_id="trace", name="pxi.turn", kind="AGENT", parent_id=None)
    spans = _FakeSpans([root], {"trace": [root]}, [])

    async def stub(_target: v1.Span, _spans: Any) -> Score:
        return Score(score=1.0)

    specs = [
        replace(TOOL_COUNT_PER_TURN, name="first", evaluate=stub),
        replace(TOOL_COUNT_PER_TURN, name="second", evaluate=stub),
    ]
    summaries = _run(
        _FakeClient(spans),
        project="pxi_dev",
        specs=specs,
        now=datetime(2026, 7, 9, 2, tzinfo=timezone.utc),
    )

    assert len(_discovery_requests(spans)) == 1
    assert summaries["first"].discovered == 1
    assert summaries["second"].discovered == 1


def test_tool_selector_issues_its_own_unparented_query() -> None:
    root = _span("root", trace_id="trace", name="pxi.turn", kind="AGENT", parent_id=None)
    tool = _accepted("tool", trace_id="trace", parent_id="root")
    spans = _FakeSpans([root, tool], {"trace": [root, tool]}, [])

    _run(
        _FakeClient(spans),
        project="pxi_dev",
        specs=[SUGGESTION_ACCEPTED],
        now=datetime(2026, 7, 9, 2, tzinfo=timezone.utc),
    )

    (request,) = _discovery_requests(spans)
    assert "parent_id" not in request
    assert request["span_kind"] == ["TOOL"]
    # Discovery is by recorded decision, not by a hand-maintained tool list.
    assert "name" not in request
    assert request["attributes"] == {APPROVAL_SOURCE_ATTRIBUTE: "user"}


def test_mixed_selectors_each_receive_only_their_own_candidates() -> None:
    root = _span("root", trace_id="trace", name="pxi.turn", kind="AGENT", parent_id=None)
    tool = _rejected("tool", trace_id="trace", parent_id="root")
    spans = _FakeSpans([root, tool], {"trace": [root, tool]}, [])

    summaries = _run(
        _FakeClient(spans),
        project="pxi_dev",
        specs=[TOOL_COUNT_PER_TURN, SUGGESTION_ACCEPTED],
        now=datetime(2026, 7, 9, 2, tzinfo=timezone.utc),
    )

    assert len(_discovery_requests(spans)) == 2
    assert summaries["tool_count_per_turn"].discovered == 1
    assert summaries["suggestion_accepted"].discovered == 1
    assert {(annotation["name"], annotation["span_id"]) for annotation in spans.writes} == {
        ("tool_count_per_turn", "root"),
        ("suggestion_accepted", "tool"),
    }


def test_multiple_targets_in_one_trace_hydrate_once_and_annotate_separately() -> None:
    """One turn can contain suggestions the user decided differently; each
    TOOL span keeps its own outcome rather than collapsing to a turn label."""
    root = _span("root", trace_id="trace", name="pxi.turn", kind="AGENT", parent_id=None)
    rejected = _rejected("tool-rejected", trace_id="trace", parent_id="root")
    accepted = _accepted("tool-accepted", trace_id="trace", parent_id="root")
    spans = _FakeSpans([root, rejected, accepted], {"trace": [root, rejected, accepted]}, [])

    summary = _run(
        _FakeClient(spans),
        project="pxi_dev",
        specs=[SUGGESTION_ACCEPTED],
        now=datetime(2026, 7, 9, 2, tzinfo=timezone.utc),
    )["suggestion_accepted"]

    assert spans.hydrated_trace_ids == ["trace"]
    assert summary.discovered == 2
    assert summary.evaluated == 2
    assert {
        annotation["span_id"]: annotation["result"]["label"] for annotation in spans.writes
    } == {"tool-rejected": "rejected", "tool-accepted": "accepted"}


def test_checkpoint_on_one_target_does_not_suppress_another_in_the_same_trace() -> None:
    root = _span("root", trace_id="trace", name="pxi.turn", kind="AGENT", parent_id=None)
    done = _accepted("tool-done", trace_id="trace", parent_id="root")
    todo = _rejected("tool-todo", trace_id="trace", parent_id="root")
    existing: v1.SpanAnnotation = {
        **_existing("tool-done", identifier=SUGGESTION_ACCEPTED.identifier),
        "name": "suggestion_accepted",
    }
    spans = _FakeSpans([root, done, todo], {"trace": [root, done, todo]}, [existing])

    summary = _run(
        _FakeClient(spans),
        project="pxi_dev",
        specs=[SUGGESTION_ACCEPTED],
        now=datetime(2026, 7, 9, 2, tzinfo=timezone.utc),
    )["suggestion_accepted"]

    assert summary.discovered == 2
    assert summary.already_annotated == 1
    assert summary.evaluated == 1
    assert [annotation["span_id"] for annotation in spans.writes] == ["tool-todo"]


@pytest.mark.parametrize("sample_rate", [1.0, 0.0])
def test_sampling_includes_or_excludes_every_target_in_a_trace(sample_rate: float) -> None:
    """Sampling is keyed on trace_id, so a turn is never partially annotated."""
    root = _span("root", trace_id="trace", name="pxi.turn", kind="AGENT", parent_id=None)
    first = _accepted("tool-1", trace_id="trace", parent_id="root")
    second = _rejected("tool-2", trace_id="trace", parent_id="root")
    spans = _FakeSpans([root, first, second], {"trace": [root, first, second]}, [])

    summary = _run(
        _FakeClient(spans),
        project="pxi_dev",
        specs=[replace(SUGGESTION_ACCEPTED, sample_rate=sample_rate)],
        now=datetime(2026, 7, 9, 2, tzinfo=timezone.utc),
    )["suggestion_accepted"]

    assert summary.discovered == 2
    assert (summary.evaluated, summary.sampled_out) == ((2, 0) if sample_rate else (0, 2))


def test_settle_delay_applies_to_a_non_root_target_end_time() -> None:
    """An in-flight TOOL span waits for the next run even though its root settled."""
    root = _span("root", trace_id="trace", name="pxi.turn", kind="AGENT", parent_id=None)
    root["end_time"] = "2026-07-09T01:00:00+00:00"
    settled = _accepted("tool-settled", trace_id="trace", parent_id="root")
    settled["end_time"] = "2026-07-09T01:50:00+00:00"
    recent = _accepted("tool-recent", trace_id="trace", parent_id="root")
    recent["end_time"] = "2026-07-09T01:59:00+00:00"
    spans = _FakeSpans([root, settled, recent], {"trace": [root, settled, recent]}, [])

    summary = _run(
        _FakeClient(spans),
        project="pxi_dev",
        specs=[SUGGESTION_ACCEPTED],
        now=datetime(2026, 7, 9, 2, tzinfo=timezone.utc),
    )["suggestion_accepted"]

    assert summary.discovered == 1
    assert [annotation["span_id"] for annotation in spans.writes] == ["tool-settled"]


def test_candidate_limit_failure_identifies_the_offending_selector() -> None:
    tools = [
        _accepted(f"tool-{index}", trace_id=f"trace-{index}", parent_id="root")
        for index in range(2)
    ]
    spans = _FakeSpans(tools, {}, [])

    with (
        mock.patch.object(run_module, "MAX_CANDIDATE_SPANS", 2),
        pytest.raises(RuntimeError, match="candidate discovery for selector .*TOOL"),
    ):
        _run(
            _FakeClient(spans),
            project="pxi_dev",
            specs=[SUGGESTION_ACCEPTED],
            now=datetime(2026, 7, 9, 2, tzinfo=timezone.utc),
        )


def test_failure_on_one_target_is_isolated_from_its_sibling() -> None:
    root = _span("root", trace_id="trace", name="pxi.turn", kind="AGENT", parent_id=None)
    failing = _accepted("tool-failing", trace_id="trace", parent_id="root")
    healthy = _accepted("tool-healthy", trace_id="trace", parent_id="root")
    spans = _FakeSpans([root, failing, healthy], {"trace": [root, failing, healthy]}, [])

    async def evaluate(target: v1.Span, trace_spans: Any) -> Any:
        if target["context"]["span_id"] == "tool-failing":
            raise ValueError("malformed output")
        return await SUGGESTION_ACCEPTED.evaluate(target, trace_spans)

    summary = _run(
        _FakeClient(spans),
        project="pxi_dev",
        specs=[replace(SUGGESTION_ACCEPTED, evaluate=evaluate)],
        now=datetime(2026, 7, 9, 2, tzinfo=timezone.utc),
    )["suggestion_accepted"]

    assert (summary.errors, summary.evaluated) == (1, 1)
    assert [annotation["span_id"] for annotation in spans.writes] == ["tool-healthy"]


def test_non_root_targets_batch_and_respect_dry_run() -> None:
    root = _span("root", trace_id="trace", name="pxi.turn", kind="AGENT", parent_id=None)
    tools = [_accepted(f"tool-{index}", trace_id="trace", parent_id="root") for index in range(3)]
    spans = _FakeSpans([root, *tools], {"trace": [root, *tools]}, [])

    with mock.patch.object(run_module, "ANNOTATION_WRITE_BATCH_SIZE", 2):
        batched = _run(
            _FakeClient(spans),
            project="pxi_dev",
            specs=[SUGGESTION_ACCEPTED],
            now=datetime(2026, 7, 9, 2, tzinfo=timezone.utc),
        )["suggestion_accepted"]

    assert [len(batch) for batch in spans.write_batches] == [2, 1]
    assert batched.annotations == 3

    dry_spans = _FakeSpans([root, *tools], {"trace": [root, *tools]}, [])
    dry = _run(
        _FakeClient(dry_spans),
        project="pxi_dev",
        specs=[SUGGESTION_ACCEPTED],
        now=datetime(2026, 7, 9, 2, tzinfo=timezone.utc),
        dry_run=True,
    )["suggestion_accepted"]

    assert dry.annotations == 3
    assert dry_spans.writes == []


def test_suggestion_accepted_needs_no_judge_credentials() -> None:
    root = _span("root", trace_id="trace", name="pxi.turn", kind="AGENT", parent_id=None)
    tool = _accepted("tool", trace_id="trace", parent_id="root")
    spans = _FakeSpans([root, tool], {"trace": [root, tool]}, [])

    with mock.patch.dict("os.environ", {}, clear=True):
        summary = _run(
            _FakeClient(spans),
            project="pxi_dev",
            specs=[SUGGESTION_ACCEPTED],
            now=datetime(2026, 7, 9, 2, tzinfo=timezone.utc),
        )["suggestion_accepted"]

    assert summary.evaluated == 1


def test_cli_help_lists_the_suggestion_evaluator() -> None:
    action = next(
        action for action in run_module.build_arg_parser()._actions if action.dest == "eval"
    )
    assert "suggestion_accepted" in (action.choices or [])


def test_one_selectors_discovery_failure_does_not_sink_the_other_evaluators() -> None:
    """Selectors use different server features, so they can fail independently.

    Attribute filtering needs a newer Phoenix than name filtering; a server that
    rejects it must not take the turn-root evaluators down with it.
    """
    root = _span("root", trace_id="trace", name="pxi.turn", kind="AGENT", parent_id=None)
    spans = _FakeSpans([root], {"trace": [root]}, [])
    real_get_spans = spans.get_spans

    def failing_for_attribute_queries(**kwargs: Any) -> list[v1.Span]:
        if kwargs.get("attributes"):
            raise RuntimeError("server too old for attribute filtering")
        return real_get_spans(**kwargs)

    spans.get_spans = failing_for_attribute_queries  # type: ignore[method-assign]

    summaries = _run(
        _FakeClient(spans),
        project="pxi_dev",
        specs=[TOOL_COUNT_PER_TURN, SUGGESTION_ACCEPTED],
        now=datetime(2026, 7, 9, 2, tzinfo=timezone.utc),
    )

    assert summaries["tool_count_per_turn"].discovered == 1
    assert summaries["tool_count_per_turn"].annotations == 1
    assert summaries["suggestion_accepted"].discovered == 0
    assert summaries["suggestion_accepted"].errors == 1

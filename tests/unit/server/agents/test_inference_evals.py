from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timezone
from types import SimpleNamespace
from typing import Any

import pytest
from openinference.semconv.trace import OpenInferenceSpanKindValues, SpanAttributes
from sqlalchemy import select

from phoenix.db import models
from phoenix.server.agents.inference_evals import (
    EvalTriggerSpanProcessor,
    FinishedSpan,
    FinishedTrace,
    InferenceEvalDispatcher,
    _append_eval_spans_to_existing_trace,
    _is_turn_start,
    _sample,
    _score_tool_count_per_turn,
    _score_trace,
)
from phoenix.server.api.routers import agents as agents_router
from phoenix.server.api.routers.agents import _add_pxi_inference_eval_processor
from phoenix.server.types import DbSessionFactory
from phoenix.tracers import Tracer


class _Dispatcher:
    def __init__(self) -> None:
        self.traces: list[FinishedTrace] = []

    def enqueue_threadsafe(self, trace: FinishedTrace) -> None:
        self.traces.append(trace)


@dataclass(frozen=True)
class _SpanContext:
    trace_id: int
    span_id: int


@dataclass(frozen=True)
class _Parent:
    span_id: int


class _Span:
    def __init__(
        self,
        *,
        trace_id: int,
        span_id: int,
        parent_id: int | None,
        name: str,
        attributes: dict[str, Any],
    ) -> None:
        self._context = _SpanContext(trace_id=trace_id, span_id=span_id)
        self.parent = _Parent(parent_id) if parent_id is not None else None
        self.name = name
        self.attributes = attributes

    def get_span_context(self) -> _SpanContext:
        return self._context


class _TracerProvider:
    def __init__(self) -> None:
        self.processors: list[EvalTriggerSpanProcessor] = []

    def add_span_processor(self, processor: EvalTriggerSpanProcessor) -> None:
        self.processors.append(processor)


class _Tracer:
    def __init__(self) -> None:
        self.tracer_provider = _TracerProvider()


def test_add_pxi_inference_eval_processor_reads_lifespan_request_state(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(agents_router, "get_env_pxi_inference_evals_enabled", lambda: True)
    dispatcher = InferenceEvalDispatcher.__new__(InferenceEvalDispatcher)
    tracer = _Tracer()
    request = SimpleNamespace(
        state=SimpleNamespace(pxi_inference_eval_dispatcher=dispatcher),
        app=SimpleNamespace(state=SimpleNamespace()),
    )

    _add_pxi_inference_eval_processor(
        request=request,  # type: ignore[arg-type]
        tracer=tracer,  # type: ignore[arg-type]
        project_name="assistant_agent",
        ingest_traces=True,
        export_remote_traces=False,
    )

    assert len(tracer.tracer_provider.processors) == 1
    processor = tracer.tracer_provider.processors[0]
    assert processor._dispatcher is dispatcher


def test_eval_trigger_span_processor_assembles_trace_on_agent_root_end() -> None:
    dispatcher = _Dispatcher()
    processor = EvalTriggerSpanProcessor(
        dispatcher=dispatcher,  # type: ignore[arg-type]
        project_name="assistant_agent",
        enable_local_ingest=True,
        enable_remote_export=True,
    )
    child = _Span(
        trace_id=1,
        span_id=2,
        parent_id=1,
        name="tool",
        attributes={SpanAttributes.OPENINFERENCE_SPAN_KIND: OpenInferenceSpanKindValues.TOOL.value},
    )
    root = _Span(
        trace_id=1,
        span_id=1,
        parent_id=None,
        name="PXIAgent.iter",
        attributes={
            SpanAttributes.OPENINFERENCE_SPAN_KIND: OpenInferenceSpanKindValues.AGENT.value,
            SpanAttributes.SESSION_ID: "session-1",
        },
    )

    processor.on_start(child)  # type: ignore[arg-type]
    processor.on_end(child)  # type: ignore[arg-type]
    processor.on_start(root)  # type: ignore[arg-type]
    processor.on_end(root)  # type: ignore[arg-type]

    assert len(dispatcher.traces) == 1
    trace = dispatcher.traces[0]
    assert trace.root.name == "PXIAgent.iter"
    assert trace.session_id == "session-1"
    assert trace.enable_local_ingest is True
    assert trace.enable_remote_export is True
    assert {span.name for span in trace.spans} == {"tool", "PXIAgent.iter"}


def test_eval_trigger_span_processor_treats_zero_parent_id_as_root() -> None:
    dispatcher = _Dispatcher()
    processor = EvalTriggerSpanProcessor(
        dispatcher=dispatcher,  # type: ignore[arg-type]
        project_name="assistant_agent",
        enable_local_ingest=True,
        enable_remote_export=False,
    )
    root = _Span(
        trace_id=1,
        span_id=1,
        parent_id=0,
        name="PXIAgent.iter",
        attributes={
            SpanAttributes.OPENINFERENCE_SPAN_KIND: OpenInferenceSpanKindValues.AGENT.value,
        },
    )

    processor.on_end(root)  # type: ignore[arg-type]

    assert len(dispatcher.traces) == 1
    assert dispatcher.traces[0].root.parent_id is None


def test_eval_trigger_span_processor_ignores_non_pxi_agent_root() -> None:
    dispatcher = _Dispatcher()
    processor = EvalTriggerSpanProcessor(
        dispatcher=dispatcher,  # type: ignore[arg-type]
        project_name="assistant_agent",
        enable_local_ingest=True,
        enable_remote_export=False,
    )
    root = _Span(
        trace_id=1,
        span_id=1,
        parent_id=None,
        name="ServerAgent.iter",
        attributes={
            SpanAttributes.OPENINFERENCE_SPAN_KIND: OpenInferenceSpanKindValues.AGENT.value,
        },
    )

    processor.on_end(root)  # type: ignore[arg-type]

    assert dispatcher.traces == []


def test_turn_start_rejects_tool_continuation_payload() -> None:
    trace = _trace_with_root_input(json.dumps({"parts": [{"tool_name": "search"}]}))

    assert not _is_turn_start(trace)


def test_turn_start_accepts_plain_text_input() -> None:
    trace = _trace_with_root_input("show me traces from yesterday")

    assert _is_turn_start(trace)


def test_tool_count_per_turn_counts_tool_spans() -> None:
    trace = FinishedTrace(
        trace_id="trace",
        root=FinishedSpan(
            span_id="root",
            trace_id="trace",
            parent_id=None,
            name="PXIAgent.iter",
            span_kind=OpenInferenceSpanKindValues.AGENT.value,
            attributes={},
        ),
        spans=(
            _finished_span("tool-1", OpenInferenceSpanKindValues.TOOL.value),
            _finished_span("tool-2", OpenInferenceSpanKindValues.TOOL.value),
            _finished_span("llm", OpenInferenceSpanKindValues.LLM.value),
        ),
        session_id="session",
        project_name="assistant_agent",
        enable_local_ingest=True,
        enable_remote_export=False,
    )

    annotation = _score_tool_count_per_turn(trace)[0]

    assert annotation.name == "tool_count_per_turn"
    assert annotation.score == 2.0
    assert annotation.annotator_kind == "CODE"


async def test_score_trace_weaves_eval_spans_under_pxi_root() -> None:
    trace = _trace_with_root_input("hello")
    eval_tracer = Tracer(
        span_cost_calculator=None,  # type: ignore[arg-type]
        enable_remote_export=False,
        project_name="assistant_agent",
    )

    annotations = await _score_trace(trace, eval_tracer=eval_tracer)
    eval_tracer.tracer_provider.force_flush()
    db_traces = eval_tracer.get_db_traces(project_id=1)
    eval_tracer.tracer_provider.shutdown()

    assert {annotation.name for annotation in annotations} == {
        "tool_count_per_turn",
    }
    assert len(db_traces) == 1
    db_trace = db_traces[0]
    assert db_trace.trace_id == trace.trace_id
    spans_by_name = {span.name: span for span in db_trace.spans}
    group_span = spans_by_name["PXI inference evals"]
    assert group_span.parent_id == trace.root.span_id
    assert spans_by_name["tool_count_per_turn.evaluate"].parent_id == group_span.span_id
    assert group_span.attributes["pxi"]["inference_eval"]["trigger"] == "inference"
    assert group_span.attributes["pxi"]["evaluated"]["span_id"] == trace.root.span_id


async def test_score_trace_skips_tool_continuation_roots() -> None:
    trace = _trace_with_root_input(json.dumps({"parts": [{"tool_name": "search"}]}))
    eval_tracer = Tracer(
        span_cost_calculator=None,  # type: ignore[arg-type]
        enable_remote_export=False,
        project_name="assistant_agent",
    )

    annotations = await _score_trace(trace, eval_tracer=eval_tracer)
    eval_tracer.tracer_provider.force_flush()
    db_traces = eval_tracer.get_db_traces(project_id=1)
    eval_tracer.tracer_provider.shutdown()

    assert annotations == []
    assert db_traces == []


async def test_append_eval_spans_requires_existing_trace(db: DbSessionFactory) -> None:
    trace = _trace_with_root_input("hello")
    eval_tracer = Tracer(
        span_cost_calculator=None,  # type: ignore[arg-type]
        enable_remote_export=False,
        project_name="assistant_agent",
    )
    await _score_trace(trace, eval_tracer=eval_tracer)
    eval_tracer.tracer_provider.force_flush()
    db_traces = eval_tracer.get_db_traces(project_id=1)
    eval_tracer.tracer_provider.shutdown()

    assert not await _append_eval_spans_to_existing_trace(
        db=db,
        db_traces=db_traces,
        project_name="assistant_agent",
    )

    now = datetime.now(timezone.utc)
    async with db() as session:
        project = models.Project(name="assistant_agent")
        session.add(project)
        await session.flush()
        db_trace = models.Trace(
            project_rowid=project.id,
            trace_id=trace.trace_id,
            start_time=now,
            end_time=now,
        )
        session.add(db_trace)
        await session.flush()
        session.add(
            models.Span(
                trace_rowid=db_trace.id,
                span_id=trace.root.span_id,
                parent_id=None,
                name=trace.root.name,
                span_kind=OpenInferenceSpanKindValues.AGENT.value,
                start_time=now,
                end_time=now,
                attributes={},
                events=[],
                status_code="OK",
                status_message="",
                cumulative_error_count=0,
                cumulative_llm_token_count_prompt=0,
                cumulative_llm_token_count_completion=0,
            )
        )
        await session.flush()

    assert await _append_eval_spans_to_existing_trace(
        db=db,
        db_traces=db_traces,
        project_name="assistant_agent",
    )
    async with db() as session:
        span_rows = {
            span.name: span async for span in await session.stream_scalars(select(models.Span))
        }

    assert set(span_rows) == {
        "PXIAgent.iter",
        "PXI inference evals",
        "tool_count_per_turn.evaluate",
    }
    assert span_rows["PXI inference evals"].parent_id == trace.root.span_id


def test_sample_is_deterministic() -> None:
    assert _sample("abc", 0.5) == _sample("abc", 0.5)
    assert _sample("abc", 1.0)
    assert not _sample("abc", 0.0)


def test_dispatcher_exposes_drop_count() -> None:
    dispatcher = InferenceEvalDispatcher(
        db=None,  # type: ignore[arg-type]
        enqueue_annotations=None,  # type: ignore[arg-type]
        span_cost_calculator=None,  # type: ignore[arg-type]
    )

    assert dispatcher.dropped_count == 0


def _trace_with_root_input(input_value: str) -> FinishedTrace:
    root = FinishedSpan(
        span_id="0000000000000001",
        trace_id="00000000000000000000000000000001",
        parent_id=None,
        name="PXIAgent.iter",
        span_kind=OpenInferenceSpanKindValues.AGENT.value,
        attributes={SpanAttributes.INPUT_VALUE: input_value},
    )
    return FinishedTrace(
        trace_id="00000000000000000000000000000001",
        root=root,
        spans=(root,),
        session_id="session",
        project_name="assistant_agent",
        enable_local_ingest=True,
        enable_remote_export=False,
    )


def _finished_span(span_id: str, span_kind: str) -> FinishedSpan:
    return FinishedSpan(
        span_id=span_id,
        trace_id="trace",
        parent_id="root",
        name=span_id,
        span_kind=span_kind,
        attributes={},
    )

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import time
from collections import OrderedDict
from collections.abc import Awaitable, Callable, Sequence
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Literal, cast

import httpx
from openinference.semconv.trace import OpenInferenceSpanKindValues, SpanAttributes
from opentelemetry.context import Context
from opentelemetry.sdk.trace import ReadableSpan, SpanProcessor
from opentelemetry.sdk.trace import Span as SDKSpan
from opentelemetry.trace import (
    NonRecordingSpan,
    Span,
    SpanContext,
    TraceFlags,
    TraceState,
    format_span_id,
    format_trace_id,
    set_span_in_context,
)
from sqlalchemy import select

from phoenix.client import AsyncClient
from phoenix.client.resources.spans import SpanAnnotationData, SpanAnnotationResult
from phoenix.config import (
    get_env_phoenix_agents_assistant_project_name,
    get_env_phoenix_agents_collector_api_key,
    get_env_phoenix_agents_collector_endpoint,
    get_env_pxi_inference_evals_sample_rate,
)
from phoenix.db import models
from phoenix.db.insertion.helpers import OnConflict, insert_on_conflict
from phoenix.db.insertion.span import insert_span
from phoenix.db.insertion.types import Precursors
from phoenix.server.agents.agent_factory import PXI_AGENT_NAME
from phoenix.server.daemons.span_cost_calculator import SpanCostCalculator
from phoenix.server.telemetry import normalize_http_collector_endpoint
from phoenix.server.types import DbSessionFactory
from phoenix.trace.schemas import (
    Span as TraceSpan,
)
from phoenix.trace.schemas import (
    SpanContext as TraceSpanContext,
)
from phoenix.trace.schemas import (
    SpanEvent,
    SpanKind,
    SpanStatusCode,
)
from phoenix.tracers import Tracer, detached_otel_context

logger = logging.getLogger(__name__)

_QUEUE_MAX_SIZE = 200
_WORKER_COUNT = 2
_REMOTE_RETRY_DELAYS_SECONDS = (2.0, 4.0, 8.0, 16.0, 32.0)
_LOCAL_TRACE_APPEND_RETRY_DELAYS_SECONDS = (0.05, 0.1, 0.2, 0.5, 1.0)
_TRACE_BUFFER_TTL_SECONDS = 300
_TRACE_BUFFER_MAX_SIZE = 500
_PXI_ROOT_SPAN_NAME = f"{PXI_AGENT_NAME}.iter"
_ANNOTATION_IDENTIFIER = "pxi-inference-evals"
_INFERENCE_EVAL_TRIGGER = "inference"


@dataclass(frozen=True)
class FinishedSpan:
    span_id: str
    trace_id: str
    parent_id: str | None
    name: str
    span_kind: str | None
    attributes: dict[str, Any]


@dataclass(frozen=True)
class FinishedTrace:
    trace_id: str
    root: FinishedSpan
    spans: tuple[FinishedSpan, ...]
    project_name: str
    enable_local_ingest: bool
    enable_remote_export: bool


@dataclass(frozen=True)
class InferenceEvalAnnotation:
    span_id: str
    name: str
    annotator_kind: Literal["LLM", "CODE"]
    label: str | None = None
    score: float | None = None
    explanation: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)
    identifier: str = _ANNOTATION_IDENTIFIER

    def as_span_annotation_data(self) -> SpanAnnotationData:
        result: dict[str, Any] = {}
        if self.label is not None:
            result["label"] = self.label
        if self.score is not None:
            result["score"] = self.score
        if self.explanation is not None:
            result["explanation"] = self.explanation
        payload: dict[str, Any] = {
            "span_id": self.span_id,
            "name": self.name,
            "annotator_kind": self.annotator_kind,
            "metadata": self.metadata,
            "identifier": self.identifier,
        }
        if result:
            payload["result"] = cast(SpanAnnotationResult, result)
        return cast(SpanAnnotationData, payload)

    def as_precursor(self) -> Precursors.SpanAnnotation:
        return Precursors.SpanAnnotation(
            updated_at=datetime.now(timezone.utc),
            span_id=self.span_id,
            obj=models.SpanAnnotation(
                name=self.name,
                annotator_kind=self.annotator_kind,
                score=self.score,
                label=self.label,
                explanation=self.explanation,
                metadata_=self.metadata,
                identifier=self.identifier,
                source="API",
            ),
        )


@dataclass
class _TraceBuffer:
    created_at: float
    spans: dict[str, FinishedSpan] = field(default_factory=dict)


class EvalTriggerSpanProcessor(SpanProcessor):
    """Buffers PXI spans and enqueues a finished trace when an AGENT root span ends."""

    def __init__(
        self,
        *,
        dispatcher: InferenceEvalDispatcher,
        project_name: str,
        enable_local_ingest: bool,
        enable_remote_export: bool,
        ttl_seconds: float = _TRACE_BUFFER_TTL_SECONDS,
        max_traces: int = _TRACE_BUFFER_MAX_SIZE,
    ) -> None:
        self._dispatcher = dispatcher
        self._project_name = project_name
        self._enable_local_ingest = enable_local_ingest
        self._enable_remote_export = enable_remote_export
        self._ttl_seconds = ttl_seconds
        self._max_traces = max_traces
        self._buffers: OrderedDict[str, _TraceBuffer] = OrderedDict()

    def on_start(self, span: SDKSpan, parent_context: Context | None = None) -> None:
        self._remember(_snapshot_span(span))

    def on_end(self, span: ReadableSpan) -> None:
        finished_span = _snapshot_span(span)
        buffer = self._remember(finished_span)
        if (
            _is_root_span(finished_span)
            and finished_span.name == _PXI_ROOT_SPAN_NAME
            and finished_span.span_kind == OpenInferenceSpanKindValues.AGENT.value
        ):
            trace = FinishedTrace(
                trace_id=finished_span.trace_id,
                root=finished_span,
                spans=tuple(buffer.spans.values()),
                project_name=self._project_name,
                enable_local_ingest=self._enable_local_ingest,
                enable_remote_export=self._enable_remote_export,
            )
            self._buffers.pop(finished_span.trace_id, None)
            self._dispatcher.enqueue_threadsafe(trace)

    def shutdown(self) -> None:
        self._buffers.clear()

    def force_flush(self, timeout_millis: int = 30000) -> bool:
        return True

    def _remember(self, span: FinishedSpan) -> _TraceBuffer:
        self._evict_old()
        buffer = self._buffers.get(span.trace_id)
        if buffer is None:
            buffer = _TraceBuffer(created_at=time.monotonic())
            self._buffers[span.trace_id] = buffer
        self._buffers.move_to_end(span.trace_id)
        buffer.spans[span.span_id] = span
        while len(self._buffers) > self._max_traces:
            trace_id, _ = self._buffers.popitem(last=False)
            logger.warning(
                "Evicted PXI inference eval trace buffer %s after max-size overflow", trace_id
            )
        return buffer

    def _evict_old(self) -> None:
        now = time.monotonic()
        expired = [
            trace_id
            for trace_id, buffer in self._buffers.items()
            if now - buffer.created_at > self._ttl_seconds
        ]
        for trace_id in expired:
            self._buffers.pop(trace_id, None)
            logger.warning("Evicted stale PXI inference eval trace buffer %s", trace_id)


class InferenceEvalDispatcher:
    """Runs PXI inference evals off the request path and writes span annotations."""

    def __init__(
        self,
        *,
        db: DbSessionFactory,
        enqueue_annotations: Callable[..., Awaitable[None]],
        span_cost_calculator: SpanCostCalculator,
        queue_max_size: int = _QUEUE_MAX_SIZE,
        worker_count: int = _WORKER_COUNT,
    ) -> None:
        self._db = db
        self._enqueue_annotations = enqueue_annotations
        self._span_cost_calculator = span_cost_calculator
        self._queue: asyncio.Queue[FinishedTrace | None] = asyncio.Queue(maxsize=queue_max_size)
        self._worker_count = worker_count
        self._workers: list[asyncio.Task[None]] = []
        self._loop: asyncio.AbstractEventLoop | None = None
        self._dropped_count = 0
        self._accepting = False
        self._remote_client: AsyncClient | None = None
        self._global_sample_rate = get_env_pxi_inference_evals_sample_rate()

    @property
    def dropped_count(self) -> int:
        return self._dropped_count

    async def __aenter__(self) -> "InferenceEvalDispatcher":
        self._loop = asyncio.get_running_loop()
        self._accepting = True
        if endpoint := get_env_phoenix_agents_collector_endpoint():
            base_url = normalize_http_collector_endpoint(endpoint)
            self._remote_client = AsyncClient(
                base_url=base_url,
                api_key=get_env_phoenix_agents_collector_api_key(),
            )
        self._workers = [
            asyncio.create_task(self._worker(), name=f"pxi-inference-eval-worker-{i}")
            for i in range(self._worker_count)
        ]
        return self

    async def __aexit__(self, *args: object) -> None:
        self._accepting = False
        for _ in self._workers:
            await self._queue.put(None)
        await asyncio.gather(*self._workers, return_exceptions=True)
        if self._remote_client is not None:
            await self._remote_client._client.aclose()

    def enqueue_threadsafe(self, trace: FinishedTrace) -> None:
        loop = self._loop
        if loop is None or not self._accepting:
            return
        loop.call_soon_threadsafe(self._enqueue_nowait, trace)

    def _enqueue_nowait(self, trace: FinishedTrace) -> None:
        if not self._accepting:
            return
        try:
            self._queue.put_nowait(trace)
        except asyncio.QueueFull:
            self._dropped_count += 1
            logger.warning(
                "Dropped PXI inference eval trace %s because the queue is full", trace.trace_id
            )

    async def _worker(self) -> None:
        while True:
            trace = await self._queue.get()
            try:
                if trace is None:
                    return
                await self._process_trace(trace)
            except Exception:
                logger.exception("PXI inference eval worker failed while processing a trace")
            finally:
                self._queue.task_done()

    async def _process_trace(self, trace: FinishedTrace) -> None:
        if not _sample(trace.trace_id, self._global_sample_rate):
            return
        annotations: list[InferenceEvalAnnotation] = []
        eval_tracer = Tracer(
            span_cost_calculator=self._span_cost_calculator,
            enable_remote_export=trace.enable_remote_export,
            project_name=trace.project_name,
        )
        try:
            with detached_otel_context():
                annotations.extend(await _score_trace(trace, eval_tracer=eval_tracer))
        finally:
            try:
                eval_tracer.tracer_provider.force_flush()
                if trace.enable_local_ingest:
                    await self._persist_eval_traces(
                        eval_tracer=eval_tracer,
                        project_name=trace.project_name,
                        target_trace_id=trace.trace_id,
                    )
            except Exception:
                logger.exception(
                    "PXI inference eval span persistence failed for trace %s", trace.trace_id
                )
            finally:
                eval_tracer.tracer_provider.shutdown()

        if annotations:
            await self._write_annotations(trace=trace, annotations=annotations)

    async def _persist_eval_traces(
        self,
        *,
        eval_tracer: Tracer,
        project_name: str,
        target_trace_id: str,
    ) -> None:
        project_id = await _ensure_project_exists(self._db, project_name)
        db_traces = eval_tracer.get_db_traces(project_id=project_id)
        if not db_traces:
            return
        for delay in (0.0, *_LOCAL_TRACE_APPEND_RETRY_DELAYS_SECONDS):
            if delay:
                await asyncio.sleep(delay)
            if await _append_eval_spans_to_existing_trace(
                db=self._db,
                db_traces=db_traces,
                project_name=project_name,
            ):
                return
        logger.warning(
            "Skipped local PXI inference eval spans for trace %s because the target trace "
            "was not persisted before append retries were exhausted",
            target_trace_id,
        )

    async def _write_annotations(
        self,
        *,
        trace: FinishedTrace,
        annotations: Sequence[InferenceEvalAnnotation],
    ) -> None:
        annotation_data = [annotation.as_span_annotation_data() for annotation in annotations]
        if trace.enable_local_ingest:
            await self._enqueue_annotations(
                *(annotation.as_precursor() for annotation in annotations)
            )
        if trace.enable_remote_export and self._remote_client is not None:
            await self._write_remote_annotations(annotation_data)

    async def _write_remote_annotations(self, annotations: Sequence[SpanAnnotationData]) -> None:
        for attempt, delay in enumerate((0.0, *_REMOTE_RETRY_DELAYS_SECONDS)):
            if delay:
                await asyncio.sleep(delay)
            remote_client = self._remote_client
            if remote_client is None:
                return
            try:
                await remote_client.spans.log_span_annotations(
                    span_annotations=annotations,
                    sync=True,
                )
                return
            except httpx.HTTPStatusError as exc:
                status_code = exc.response.status_code
                if status_code != 404 and status_code < 500:
                    logger.warning("PXI inference eval remote annotation write failed: %s", exc)
                    return
                if attempt == len(_REMOTE_RETRY_DELAYS_SECONDS):
                    logger.warning(
                        "PXI inference eval remote annotation write exhausted retries: %s", exc
                    )
            except httpx.HTTPError as exc:
                if attempt == len(_REMOTE_RETRY_DELAYS_SECONDS):
                    logger.warning(
                        "PXI inference eval remote annotation write exhausted retries: %s", exc
                    )


async def _score_trace(
    trace: FinishedTrace, *, eval_tracer: Tracer
) -> list[InferenceEvalAnnotation]:
    if not _is_turn_start(trace):
        return []
    tracer = eval_tracer.tracer_provider.get_tracer(__name__)
    annotations: list[InferenceEvalAnnotation] = []
    with tracer.start_as_current_span(
        "PXI inference evals",
        context=_target_parent_context(trace=trace, parent_span_id=trace.root.span_id),
    ) as span:
        _set_inference_eval_span_attributes(span, trace)
        annotations.extend(_run_eval("tool_count_per_turn", trace, tracer=tracer))
        span.set_attribute(
            SpanAttributes.OUTPUT_VALUE,
            json.dumps(
                [
                    {
                        "name": annotation.name,
                        "label": annotation.label,
                        "score": annotation.score,
                    }
                    for annotation in annotations
                ],
                ensure_ascii=False,
            ),
        )
    return annotations


def _run_eval(
    name: str,
    trace: FinishedTrace,
    *,
    tracer: Any,
) -> list[InferenceEvalAnnotation]:
    try:
        return _score_tool_count_per_turn(trace, tracer=tracer)
    except Exception:
        logger.exception("PXI inference eval %s failed for trace %s", name, trace.trace_id)
    return []


def _score_tool_count_per_turn(
    trace: FinishedTrace,
    *,
    tracer: Any | None = None,
) -> list[InferenceEvalAnnotation]:
    count = sum(
        1 for span in trace.spans if span.span_kind == OpenInferenceSpanKindValues.TOOL.value
    )
    annotations = [
        InferenceEvalAnnotation(
            span_id=trace.root.span_id,
            name="tool_count_per_turn",
            annotator_kind="CODE",
            score=float(count),
            explanation=f"Counted {count} TOOL spans under the PXI turn root.",
            metadata={"trace_id": trace.trace_id},
        )
    ]
    if tracer is None:
        return annotations
    input_payload = {"trace_id": trace.trace_id, "root_span_id": trace.root.span_id}
    with tracer.start_as_current_span("tool_count_per_turn.evaluate") as span:
        _set_inference_eval_span_attributes(span, trace, input_payload=input_payload)
        span.set_attribute(
            SpanAttributes.OUTPUT_VALUE,
            json.dumps({"score": count}, ensure_ascii=False),
        )
    return annotations


def _set_inference_eval_span_attributes(
    span: Span,
    trace: FinishedTrace,
    *,
    input_payload: dict[str, Any] | None = None,
) -> None:
    span.set_attribute(
        SpanAttributes.OPENINFERENCE_SPAN_KIND,
        OpenInferenceSpanKindValues.EVALUATOR.value,
    )
    span.set_attribute("pxi.evaluated.trace_id", trace.trace_id)
    span.set_attribute("pxi.evaluated.span_id", trace.root.span_id)
    span.set_attribute("pxi.inference_eval.trigger", _INFERENCE_EVAL_TRIGGER)
    if input_payload is not None:
        span.set_attribute(
            SpanAttributes.INPUT_VALUE,
            json.dumps(input_payload, ensure_ascii=False),
        )


def _target_parent_context(*, trace: FinishedTrace, parent_span_id: str) -> Context:
    parent_context = SpanContext(
        trace_id=int(trace.trace_id, 16),
        span_id=int(parent_span_id, 16),
        is_remote=True,
        trace_flags=TraceFlags(TraceFlags.SAMPLED),
        trace_state=TraceState(),
    )
    return set_span_in_context(NonRecordingSpan(parent_context), Context())


async def _append_eval_spans_to_existing_trace(
    *,
    db: DbSessionFactory,
    db_traces: Sequence[models.Trace],
    project_name: str,
) -> bool:
    trace_ids = {trace.trace_id for trace in db_traces}
    async with db() as session:
        existing_trace_ids = set(
            await session.scalars(
                select(models.Trace.trace_id).where(models.Trace.trace_id.in_(trace_ids))
            )
        )
        if trace_ids - existing_trace_ids:
            return False
        for db_trace in db_traces:
            for db_span in db_trace.spans:
                await insert_span(
                    session,
                    _trace_span_from_db_span(trace_id=db_trace.trace_id, db_span=db_span),
                    project_name,
                    create_trace_if_missing=False,
                )
        await session.flush()
    return True


def _trace_span_from_db_span(*, trace_id: str, db_span: models.Span) -> TraceSpan:
    return TraceSpan(
        name=db_span.name,
        context=TraceSpanContext(trace_id=trace_id, span_id=db_span.span_id),
        span_kind=SpanKind(db_span.span_kind),
        parent_id=db_span.parent_id,
        start_time=db_span.start_time,
        end_time=db_span.end_time,
        status_code=SpanStatusCode(db_span.status_code),
        status_message=db_span.status_message,
        attributes=db_span.attributes,
        events=[_trace_span_event(event) for event in db_span.events],
        conversation=None,
    )


def _trace_span_event(event: dict[str, Any]) -> SpanEvent:
    timestamp = event.get("timestamp")
    if isinstance(timestamp, str):
        timestamp = datetime.fromisoformat(timestamp)
    if not isinstance(timestamp, datetime):
        timestamp = datetime.now(timezone.utc)
    return SpanEvent(
        name=str(event.get("name", "")),
        timestamp=timestamp,
        attributes={key: value for key, value in event.items() if key not in {"name", "timestamp"}},
    )


def _snapshot_span(span: SDKSpan | ReadableSpan) -> FinishedSpan:
    context = span.get_span_context()
    assert context is not None
    parent = getattr(span, "parent", None)
    parent_id = format_span_id(parent.span_id) if parent is not None else None
    if parent_id == "0000000000000000":
        parent_id = None
    return FinishedSpan(
        span_id=format_span_id(context.span_id),
        trace_id=format_trace_id(context.trace_id),
        parent_id=parent_id,
        name=span.name,
        span_kind=_string_attr((span.attributes or {}).get(SpanAttributes.OPENINFERENCE_SPAN_KIND)),
        attributes=dict(span.attributes or {}),
    )


def _is_root_span(span: FinishedSpan) -> bool:
    return span.parent_id is None or span.parent_id == "0000000000000000"


def _is_turn_start(trace: FinishedTrace) -> bool:
    input_value = trace.root.attributes.get(SpanAttributes.INPUT_VALUE)
    if not isinstance(input_value, str) or not input_value.strip():
        return False
    try:
        parsed = json.loads(input_value)
    except json.JSONDecodeError:
        return True
    if isinstance(parsed, dict) and "parts" in parsed:
        return False
    return True


def _sample(trace_id: str, sample_rate: float) -> bool:
    if sample_rate >= 1:
        return True
    if sample_rate <= 0:
        return False
    digest = hashlib.sha256(trace_id.encode("utf-8")).digest()
    value = int.from_bytes(digest[:8], "big") / 2**64
    return value < sample_rate


def _string_attr(value: Any) -> str | None:
    return value if isinstance(value, str) else None


async def _ensure_project_exists(db: DbSessionFactory, project_name: str) -> int:
    async with db() as session:
        await session.execute(
            insert_on_conflict(
                {"name": project_name},
                table=models.Project,
                dialect=db.dialect,
                unique_by=("name",),
                on_conflict=OnConflict.DO_NOTHING,
            )
        )
        project_id = await session.scalar(select(models.Project.id).filter_by(name=project_name))
        assert project_id is not None
        return project_id


def build_inference_eval_processor(
    *,
    dispatcher: InferenceEvalDispatcher,
    enable_local_ingest: bool,
    enable_remote_export: bool,
    project_name: str | None = None,
) -> EvalTriggerSpanProcessor:
    return EvalTriggerSpanProcessor(
        dispatcher=dispatcher,
        project_name=project_name or get_env_phoenix_agents_assistant_project_name(),
        enable_local_ingest=enable_local_ingest,
        enable_remote_export=enable_remote_export,
    )

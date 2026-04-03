import logging
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from threading import Lock
from typing import Callable, Optional, Sequence

import wrapt
from openinference.semconv.resource import ResourceAttributes
from openinference.semconv.trace import OpenInferenceSpanKindValues, SpanAttributes
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import ReadableSpan, SpanLimits, TracerProvider
from opentelemetry.sdk.trace.export import (
    BatchSpanProcessor,
    SimpleSpanProcessor,
    SpanExporter,
    SpanExportResult,
)
from opentelemetry.trace import format_span_id, format_trace_id

from phoenix.config import (
    get_env_phoenix_pxi_collector_api_key,
    get_env_phoenix_pxi_collector_endpoint,
)
from phoenix.db import models
from phoenix.db.insertion.helpers import should_calculate_span_cost
from phoenix.server.daemons.span_cost_calculator import SpanCostCalculator
from phoenix.server.telemetry import normalize_http_collector_endpoint
from phoenix.trace.attributes import get_attribute_value, unflatten

logger = logging.getLogger(__name__)

_REQUEST_PATH_FORCE_FLUSH_TIMEOUT_MILLIS = 1_000


class _BufferedSpanExporter(SpanExporter):
    def __init__(self) -> None:
        self._finished_spans: list[ReadableSpan] = []
        self._lock = Lock()

    def export(self, spans: Sequence[ReadableSpan]) -> SpanExportResult:
        with self._lock:
            self._finished_spans.extend(spans)
        return SpanExportResult.SUCCESS

    def get_finished_spans(self) -> list[ReadableSpan]:
        with self._lock:
            return list(self._finished_spans)

    def clear(self) -> None:
        with self._lock:
            self._finished_spans.clear()

    def shutdown(self) -> None:
        return None

    def force_flush(self, timeout_millis: int = 30_000) -> bool:
        return True


def _build_remote_http_span_exporter(endpoint: str) -> SpanExporter:
    from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter

    headers = {}
    if api_key := get_env_phoenix_pxi_collector_api_key():
        headers["Authorization"] = f"Bearer {api_key}"

    return OTLPSpanExporter(
        endpoint=normalize_http_collector_endpoint(endpoint) + "/v1/traces",
        headers=headers,
    )


class Tracer(wrapt.ObjectProxy):  # type: ignore[misc]
    """
    An in-memory tracer that captures spans and builds database models.

    Because cumulative counts are computed based on the spans in the buffer,
    ensure that traces are not split across multiple calls to get_db_traces.
    It's recommended to use a separate tracer for distinct operations.

    Example usage:
        tracer = Tracer(span_cost_calculator=span_cost_calculator)

        with tracer.start_as_current_span("operation") as span:
            span.set_attribute("key", "value")
            with tracer.start_as_current_span("child-operation") as child:
                pass

        # Build trace models and persist to database

        db_traces = tracer.get_db_traces(project_id=123)
        async with db_session() as session:
            session.add_all(db_traces)
            await session.flush()

        # Access spans, span_costs, and span cost details via SQLAlchemy relationships
        db_spans = db_traces[0].spans
        db_span_costs = db_traces[0].span_costs
        db_span_cost_details = db_span_costs[0].span_cost_details
    """

    def __init__(
        self,
        *,
        span_cost_calculator: SpanCostCalculator,
        enable_remote_export: bool = False,
        project_name: str | None = None,
        remote_collector_endpoint: str | None = None,
        remote_span_exporter_factory: Callable[[str], SpanExporter] | None = None,
    ) -> None:
        self._self_span_cost_calculator = span_cost_calculator
        self._self_exporter = _BufferedSpanExporter()
        resource = Resource.create(
            {ResourceAttributes.PROJECT_NAME: project_name} if project_name else {}
        )
        # Raise the default span-attribute limit (128) so that long multi-step
        # chat conversations can record the full message history on each LLM
        # span without attribute eviction.
        span_limits = SpanLimits(max_span_attributes=100_000)
        provider = TracerProvider(resource=resource, span_limits=span_limits)
        provider.add_span_processor(SimpleSpanProcessor(self._self_exporter))

        self._self_remote_exporter: Optional[SpanExporter] = None
        remote_collector_endpoint = (
            remote_collector_endpoint or get_env_phoenix_pxi_collector_endpoint()
        )
        if enable_remote_export and remote_collector_endpoint:
            exporter_factory = remote_span_exporter_factory or _build_remote_http_span_exporter
            self._self_remote_exporter = exporter_factory(remote_collector_endpoint)
            provider.add_span_processor(BatchSpanProcessor(self._self_remote_exporter))

        self._self_provider = provider
        tracer = provider.get_tracer(__name__)
        super().__init__(tracer)

    def get_db_traces(self, *, project_id: int) -> list[models.Trace]:
        """
        Builds in-memory models.Trace objects from captured spans without persisting them.

        This method processes all finished spans captured by the tracer and
        converts them into database models. The caller is responsible for
        persisting the returned traces.

        The buffer is not cleared automatically; call clear() explicitly if needed.

        Related models are accessible via SQLAlchemy relationships:
            - trace.spans: list of Span instances
            - trace.span_costs: list of SpanCost instances
            - span.span_cost: optional SpanCost instance
            - span_cost.span_cost_details: list of SpanCostDetail instances

        Args:
            project_id: The project ID to associate the traces with.

        Returns:
            A list of models.Trace instances, or an empty list if no
            spans have been captured.
        """
        if not self.force_flush(timeout_millis=_REQUEST_PATH_FORCE_FLUSH_TIMEOUT_MILLIS):
            logger.debug("Tracer force_flush timed out before building DB traces")
        otel_spans = self._self_exporter.get_finished_spans()
        if not otel_spans:
            return []

        db_spans_by_trace_id: defaultdict[int, list[models.Span]] = defaultdict(list)
        db_span_costs_by_trace_id: defaultdict[int, list[models.SpanCost]] = defaultdict(list)

        for otel_span in otel_spans:
            trace_id = otel_span.get_span_context().trace_id  # type: ignore[no-untyped-call]
            db_span = _get_db_span(otel_span=otel_span)
            db_span_cost = _get_db_span_cost(
                db_span=db_span,
                span_cost_calculator=self._self_span_cost_calculator,
            )
            db_span.span_cost = db_span_cost  # explicitly set relationship to avoid lazy load
            db_spans_by_trace_id[trace_id].append(db_span)
            if db_span_cost:
                db_span_costs_by_trace_id[trace_id].append(db_span_cost)

        db_traces = []
        for trace_id in db_spans_by_trace_id:
            db_spans = db_spans_by_trace_id[trace_id]
            db_span_costs = db_span_costs_by_trace_id[trace_id]
            for db_span, count in zip(db_spans, _get_cumulative_counts(db_spans)):
                db_span.cumulative_error_count = count.errors
                db_span.cumulative_llm_token_count_prompt = count.prompt_tokens
                db_span.cumulative_llm_token_count_completion = count.completion_tokens
            db_trace = _get_db_trace(
                project_id=project_id,
                trace_id=trace_id,
                spans=db_spans,
            )
            db_trace.spans = db_spans  # explicitly set relationship to avoid lazy load
            db_trace.span_costs = db_span_costs  # explicitly set relationship to avoid lazy load
            db_traces.append(db_trace)

        return db_traces

    def clear(self) -> None:
        """
        Clear all captured spans from the in-memory buffer.
        """
        self._self_exporter.clear()

    def force_flush(self, timeout_millis: int = 30_000) -> bool:
        return self._self_provider.force_flush(timeout_millis)

    def shutdown(self) -> None:
        self._self_provider.shutdown()


def _get_db_trace(
    *,
    project_id: int,
    trace_id: int,
    spans: Sequence[models.Span],
) -> models.Trace:
    start_time = min(s.start_time for s in spans)
    end_time = max(s.end_time for s in spans)

    return models.Trace(
        project_rowid=project_id,
        trace_id=format_trace_id(trace_id),
        start_time=start_time,
        end_time=end_time,
    )


def _get_db_span(
    *,
    otel_span: ReadableSpan,
) -> models.Span:
    span_id = format_span_id(otel_span.get_span_context().span_id)  # type: ignore[no-untyped-call]
    parent_id: str | None = None
    if otel_span.parent is not None:
        parent_id = format_span_id(otel_span.parent.span_id)

    assert otel_span.start_time is not None
    assert otel_span.end_time is not None
    start_time = datetime.fromtimestamp(otel_span.start_time / 1e9, tz=timezone.utc)
    end_time = datetime.fromtimestamp(otel_span.end_time / 1e9, tz=timezone.utc)

    attributes = {}
    if otel_span.attributes:
        attributes = unflatten(otel_span.attributes.items())

    span_kind_attribute_value = get_attribute_value(
        attributes, SpanAttributes.OPENINFERENCE_SPAN_KIND
    )
    if isinstance(span_kind_attribute_value, str):
        span_kind = span_kind_attribute_value
    else:
        span_kind = OpenInferenceSpanKindValues.UNKNOWN.value

    events = []
    for event in otel_span.events:
        event_dict = {
            "name": event.name,
            "timestamp": datetime.fromtimestamp(event.timestamp / 1e9, tz=timezone.utc).isoformat(),
            "attributes": dict(event.attributes) if event.attributes else {},
        }
        events.append(event_dict)

    llm_token_count_prompt = None
    llm_token_count_completion = None
    if span_kind == OpenInferenceSpanKindValues.LLM.value:
        llm_token_count_prompt = get_attribute_value(
            attributes, SpanAttributes.LLM_TOKEN_COUNT_PROMPT
        )
        llm_token_count_completion = get_attribute_value(
            attributes, SpanAttributes.LLM_TOKEN_COUNT_COMPLETION
        )

    return models.Span(
        span_id=span_id,
        parent_id=parent_id,
        name=otel_span.name,
        span_kind=span_kind,
        start_time=start_time,
        end_time=end_time,
        attributes=attributes,
        events=events,
        status_code=otel_span.status.status_code.name,
        status_message=otel_span.status.description or "",
        cumulative_error_count=0,  # cannot be computed until all spans are collected
        cumulative_llm_token_count_prompt=0,  # cannot be computed until all spans are collected
        cumulative_llm_token_count_completion=0,  # cannot be computed until all spans are collected
        llm_token_count_prompt=llm_token_count_prompt,
        llm_token_count_completion=llm_token_count_completion,
    )


def _get_db_span_cost(
    *,
    db_span: models.Span,
    span_cost_calculator: SpanCostCalculator,
) -> models.SpanCost | None:
    if not should_calculate_span_cost(db_span.attributes):
        return None

    return span_cost_calculator.calculate_cost(
        start_time=db_span.start_time,
        attributes=db_span.attributes,
    )


@dataclass
class CumulativeCount:
    errors: int
    prompt_tokens: int
    completion_tokens: int


def _get_cumulative_counts(spans: Sequence[models.Span]) -> list[CumulativeCount]:
    """
    Computes cumulative counts.

    Returns a list of counts for each span in the same order as the input spans.
    """

    root_span_ids: list[str] = []
    parent_to_children_ids: dict[str, list[str]] = {}
    counts_by_span_id: dict[str, CumulativeCount] = {}
    for span in spans:
        if span.parent_id is None:
            root_span_ids.append(span.span_id)
        else:
            if span.parent_id not in parent_to_children_ids:
                parent_to_children_ids[span.parent_id] = []
            parent_to_children_ids[span.parent_id].append(span.span_id)
        counts_by_span_id[span.span_id] = CumulativeCount(
            errors=int(span.status_code == "ERROR"),
            prompt_tokens=span.llm_token_count_prompt or 0,
            completion_tokens=span.llm_token_count_completion or 0,
        )

    # iterative post-order traversal
    for root_span_id in root_span_ids:
        visited_children = False
        stack: list[tuple[str, bool]] = [(root_span_id, visited_children)]
        while stack:
            span_id, visited_children = stack.pop()
            if not visited_children:
                stack.append((span_id, True))
                for child_id in parent_to_children_ids.get(span_id, []):
                    stack.append((child_id, False))
            else:
                count = counts_by_span_id[span_id]
                for child_id in parent_to_children_ids.get(span_id, []):
                    child_counts = counts_by_span_id[child_id]
                    count.errors += child_counts.errors
                    count.prompt_tokens += child_counts.prompt_tokens
                    count.completion_tokens += child_counts.completion_tokens

    return [counts_by_span_id[span.span_id] for span in spans]

from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Sequence

import wrapt
from openinference.semconv.trace import OpenInferenceSpanKindValues, SpanAttributes
from opentelemetry.sdk.trace import ReadableSpan, TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter
from opentelemetry.trace import format_span_id, format_trace_id
from sqlalchemy.ext.asyncio import AsyncSession

from phoenix.db import models
from phoenix.db.insertion.helpers import should_calculate_span_cost
from phoenix.server.daemons.span_cost_calculator import SpanCostCalculator
from phoenix.trace.attributes import get_attribute_value, unflatten


class Tracer(wrapt.ObjectProxy):  # type: ignore[misc]
    """
    An in-memory tracer that captures spans and persists them to the database.

    Because cumulative counts are computed based on the spans in the buffer,
    ensure that traces are not split across multiple calls to save_db_models.
    It's recommended to use a separate tracer for distinct operations.

    Example usage:
        tracer = Tracer(span_cost_calculator=span_cost_calculator)

        with tracer.start_as_current_span("operation") as span:
            span.set_attribute("key", "value")
            with tracer.start_as_current_span("child-operation") as child:
                pass

        # Persist traces, spans, span costs, and span cost details to database
        async with db_session() as session:
            traces = await tracer.save_db_models(session=session, project_id=123)

        # Access spans, span_costs, and span cost details via SQLAlchemy relationships
        db_spans = db_traces[0].spans
        db_span_costs = db_traces[0].span_costs
        db_span_cost_details = db_span_costs[0].span_cost_details
    """

    def __init__(self, *, span_cost_calculator: SpanCostCalculator) -> None:
        self._self_span_cost_calculator = span_cost_calculator
        self._self_exporter = InMemorySpanExporter()
        span_processor = SimpleSpanProcessor(self._self_exporter)
        provider = TracerProvider()
        provider.add_span_processor(span_processor)
        tracer = provider.get_tracer(__name__)
        super().__init__(tracer)

    async def save_db_models(self, *, session: AsyncSession, project_id: int) -> list[models.Trace]:
        """
        Persists captured traces and spans to the database.

        This method processes all finished spans captured by the tracer,
        converts them into database models, and persists them to the database.
        The buffer is not cleared; call clear() explicitly if needed.

        Related models are accessible via SQLAlchemy relationships:
            - trace.spans: list of Span instances
            - trace.span_costs: list of SpanCost instances
            - span.span_cost: optional SpanCost instance
            - span_cost.span_cost_details: list of SpanCostDetail instances

        Args:
            session: An async SQLAlchemy session for database operations.
            project_id: The project ID to associate the traces with.

        Returns:
            A list of persisted models.Trace instances, or an empty list if no
            spans have been captured.
        """
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

        session.add_all(db_traces)
        await session.flush()

        return db_traces

    def clear(self) -> None:
        """
        Clear all captured spans from the in-memory buffer.
        """
        self._self_exporter.clear()


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

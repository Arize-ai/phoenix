from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional, Sequence

import wrapt
from openinference.semconv.trace import OpenInferenceSpanKindValues, SpanAttributes
from opentelemetry.sdk.trace import ReadableSpan, TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter
from opentelemetry.trace import format_span_id, format_trace_id
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from phoenix.db import models
from phoenix.db.insertion.helpers import should_calculate_span_cost
from phoenix.server.cost_tracking.cost_details_calculator import SpanCostDetailsCalculator
from phoenix.server.cost_tracking.cost_model_lookup import CostModelLookup
from phoenix.trace.attributes import get_attribute_value, unflatten


class Tracer(wrapt.ObjectProxy):  # type: ignore[misc]
    """
    An in-memory tracer that captures spans and persists them to the database.

    Because cumulative counts are computed based on the spans in the buffer,
    ensure that traces are not split across multiple calls to save_db_models.
    It's recommended to use a separate tracer for distinct operations.

    Example usage:
        tracer = Tracer()

        with tracer.start_as_current_span("operation") as span:
            span.set_attribute("key", "value")
            with tracer.start_as_current_span("child-operation") as child:
                pass

        # Persist traces and spans to database
        async with db_session() as session:
            traces, spans, costs = await tracer.save_db_models(session=session, project_id=123)
    """

    def __init__(self) -> None:
        self._self_exporter = InMemorySpanExporter()
        span_processor = SimpleSpanProcessor(self._self_exporter)
        provider = TracerProvider()
        provider.add_span_processor(span_processor)
        tracer = provider.get_tracer(__name__)
        super().__init__(tracer)

    async def save_db_models(
        self, *, session: AsyncSession, project_id: int
    ) -> tuple[list[models.Trace], list[models.Span], list[models.SpanCost]]:
        """
        Persists captured traces and spans to the database.

        This method processes all finished spans captured by the tracer,
        converts them into database models, and persists them to the database.
        The buffer is not cleared; call clear() explicitly if needed.

        Args:
            session: An async SQLAlchemy session for database operations.
            project_id: The project ID to associate the traces with.

        Returns:
            A tuple containing:
                - A list of persisted models.Trace instances
                - A list of persisted models.Span instances
                - A list of persisted models.SpanCost instances

            Returns empty lists if no spans have been captured.
        """
        finished_spans = self._self_exporter.get_finished_spans()
        if not finished_spans:
            return [], [], []

        db_traces, db_spans = _convert_otel_spans_to_db_traces_and_spans(
            otel_spans=finished_spans, project_id=project_id
        )
        cost_model_lookup = await _get_cost_model_lookup(session)
        span_costs = _calculate_span_costs(
            db_spans=db_spans,
            cost_model_lookup=cost_model_lookup,
        )
        session.add_all(db_traces)
        session.add_all(db_spans)
        session.add_all(span_costs)
        await session.flush()
        return db_traces, db_spans, span_costs

    def clear(self) -> None:
        """
        Clear all captured spans from the in-memory buffer.
        """
        self._self_exporter.clear()


def _convert_otel_spans_to_db_traces_and_spans(
    *, otel_spans: Sequence[ReadableSpan], project_id: int
) -> tuple[list[models.Trace], list[models.Span]]:
    """
    Convert OpenTelemetry spans to Phoenix database models.

    Args:
        otel_spans: Sequence of ReadableSpan objects to convert.
        project_id: The project ID to associate with the traces.

    Returns:
        A tuple containing:
            - A list of models.Trace instances
            - A list of models.Span instances (linked to their traces via the trace relationship)
    """
    if not otel_spans:
        return [], []

    otel_spans_by_trace_id_int: dict[int, list[ReadableSpan]] = {}
    for otel_span in otel_spans:
        trace_id_int = otel_span.get_span_context().trace_id  # type: ignore[no-untyped-call]
        if trace_id_int not in otel_spans_by_trace_id_int:
            otel_spans_by_trace_id_int[trace_id_int] = []
        otel_spans_by_trace_id_int[trace_id_int].append(otel_span)

    db_traces: list[models.Trace] = []
    db_spans: list[models.Span] = []

    for trace_id_int, trace_otel_spans in otel_spans_by_trace_id_int.items():
        trace_id = format_trace_id(trace_id_int)
        start_time = min(
            datetime.fromtimestamp(span.start_time / 1e9, tz=timezone.utc)
            for span in trace_otel_spans
            if span.start_time is not None
        )
        end_time = max(
            datetime.fromtimestamp(span.end_time / 1e9, tz=timezone.utc)
            for span in trace_otel_spans
            if span.end_time is not None
        )
        db_trace = models.Trace(
            project_rowid=project_id,
            trace_id=trace_id,
            start_time=start_time,
            end_time=end_time,
        )
        db_traces.append(db_trace)

        for otel_span in trace_otel_spans:
            span_id = format_span_id(otel_span.get_span_context().span_id)  # type: ignore[no-untyped-call]
            parent_id: Optional[str] = None
            if otel_span.parent is not None:
                parent_id = format_span_id(otel_span.parent.span_id)

            assert otel_span.start_time is not None
            assert otel_span.end_time is not None
            span_start_time = datetime.fromtimestamp(otel_span.start_time / 1e9, tz=timezone.utc)
            span_end_time = datetime.fromtimestamp(otel_span.end_time / 1e9, tz=timezone.utc)

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
                    "timestamp": datetime.fromtimestamp(
                        event.timestamp / 1e9, tz=timezone.utc
                    ).isoformat(),
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

            db_span = models.Span(
                trace=db_trace,
                span_id=span_id,
                parent_id=parent_id,
                name=otel_span.name,
                span_kind=span_kind,
                start_time=span_start_time,
                end_time=span_end_time,
                attributes=attributes,
                events=events,
                status_code=otel_span.status.status_code.name,
                status_message=otel_span.status.description or "",
                cumulative_error_count=0,  # computed below
                cumulative_llm_token_count_prompt=0,  # computed below
                cumulative_llm_token_count_completion=0,  # computed below
                llm_token_count_prompt=llm_token_count_prompt,
                llm_token_count_completion=llm_token_count_completion,
            )
            db_spans.append(db_span)

    counts = _compute_cumulative_counts(db_spans)
    for span, count in zip(db_spans, counts):
        span.cumulative_error_count = count.errors
        span.cumulative_llm_token_count_prompt = count.prompt_tokens
        span.cumulative_llm_token_count_completion = count.completion_tokens

    return db_traces, db_spans


@dataclass
class CumulativeCount:
    errors: int
    prompt_tokens: int
    completion_tokens: int


def _compute_cumulative_counts(spans: Sequence[models.Span]) -> list[CumulativeCount]:
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


def _calculate_span_costs(
    *,
    db_spans: Sequence[models.Span],
    cost_model_lookup: CostModelLookup,
) -> list[models.SpanCost]:
    """
    Calculate SpanCost and SpanCostDetail for LLM spans with token counts.

    Args:
        db_spans: Database span models with attributes and token counts
        cost_model_lookup: Lookup service for finding GenerativeModel pricing

    Returns:
        List of SpanCost models with associated SpanCostDetail entries
    """
    span_costs: list[models.SpanCost] = []

    for db_span in db_spans:
        if not should_calculate_span_cost(db_span.attributes):
            continue

        cost_model = cost_model_lookup.find_model(
            start_time=db_span.start_time,
            attributes=db_span.attributes,
        )

        calculator = SpanCostDetailsCalculator(cost_model.token_prices if cost_model else [])
        details = calculator.calculate_details(db_span.attributes)

        if not details:
            continue

        span_cost = models.SpanCost(
            span=db_span,
            trace=db_span.trace,
            span_start_time=db_span.start_time,
            model_id=cost_model.id if cost_model else None,
        )

        for detail in details:
            span_cost.append_detail(detail)

        span_costs.append(span_cost)

    return span_costs


async def _get_cost_model_lookup(session: AsyncSession) -> CostModelLookup:
    """
    Query generative models and build a CostModelLookup for cost calculation.

    Args:
        session: An async SQLAlchemy session for database operations.

    Returns:
        A CostModelLookup instance for finding pricing models.
    """
    generative_models_query = (
        select(models.GenerativeModel)
        .options(joinedload(models.GenerativeModel.token_prices))
        .where(models.GenerativeModel.deleted_at.is_(None))
    )
    generative_models = (await session.scalars(generative_models_query)).unique().all()
    return CostModelLookup(generative_models)

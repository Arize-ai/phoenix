from __future__ import annotations

from typing import cast

from openinference.semconv.trace import OpenInferenceSpanKindValues, SpanAttributes
from opentelemetry import context as otel_context
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter
from opentelemetry.trace import (
    NonRecordingSpan,
    SpanContext,
    TraceFlags,
    set_span_in_context,
)
from pydantic_ai.messages import ModelRequest, UserPromptPart
from pydantic_ai.models.test import TestModel

from phoenix.server.agents.pydantic_ai import OpenInferenceModelWrapper
from phoenix.server.api.routers.agents import _summarize_messages_with_tracing
from phoenix.tracers import Tracer


async def test_summarize_messages_with_tracing_roots_summary_span_despite_ambient_context() -> None:
    exporter = InMemorySpanExporter()
    provider = TracerProvider()
    provider.add_span_processor(SimpleSpanProcessor(exporter))
    model = OpenInferenceModelWrapper(
        TestModel(custom_output_args={"summary": "debug root spans"}),
        tracer_provider=provider,
    )
    tracer = cast(Tracer, provider.get_tracer("test"))
    ambient_context = set_span_in_context(
        NonRecordingSpan(
            SpanContext(
                trace_id=0x000000000000000000000000000000F1,
                span_id=0x00000000000000F2,
                is_remote=False,
                trace_flags=TraceFlags(TraceFlags.SAMPLED),
            )
        )
    )

    token = otel_context.attach(ambient_context)
    try:
        result = await _summarize_messages_with_tracing(
            session_id="session-123",
            history=[ModelRequest(parts=[UserPromptPart(content="Help me debug PXI traces.")])],
            model=model,
            tracer=tracer,
        )
    finally:
        otel_context.detach(token)

    assert result.summary == "debug root spans"
    spans = exporter.get_finished_spans()
    summary_spans = [
        span
        for span in spans
        if (span.attributes or {}).get(SpanAttributes.OPENINFERENCE_SPAN_KIND)
        == OpenInferenceSpanKindValues.CHAIN.value
    ]
    assert len(summary_spans) == 1
    summary_span = summary_spans[0]
    assert summary_span.name == "PXIAgent.summary"
    assert summary_span.parent is None
    assert (summary_span.attributes or {})[SpanAttributes.SESSION_ID] == "session-123"

    llm_spans = [
        span
        for span in spans
        if (span.attributes or {}).get(SpanAttributes.OPENINFERENCE_SPAN_KIND)
        == OpenInferenceSpanKindValues.LLM.value
    ]
    assert len(llm_spans) == 1
    llm_span = llm_spans[0]
    assert llm_span.parent is not None
    assert llm_span.parent.span_id == summary_span.context.span_id
    assert llm_span.context.trace_id == summary_span.context.trace_id
    assert (llm_span.attributes or {})[SpanAttributes.SESSION_ID] == "session-123"

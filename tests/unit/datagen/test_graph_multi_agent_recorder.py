from pathlib import Path

import pytest

pytest.importorskip("langchain_core")
pytest.importorskip("openinference.instrumentation.langchain")

from openinference.instrumentation.langchain import LangChainInstrumentor
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor

from scripts.datagen.graph_multi_agent import (
    MAX_HANDOFFS,
    GraphMultiAgentRecorder,
    OpenInferenceContextSpanProcessor,
    SpanCaptureExporter,
)


def test_graph_recorder_emits_named_nodes_and_bounded_agent_handoffs(tmp_path: Path) -> None:
    exporter = SpanCaptureExporter()
    tracer_provider = TracerProvider()
    tracer_provider.add_span_processor(OpenInferenceContextSpanProcessor())
    tracer_provider.add_span_processor(SimpleSpanProcessor(exporter))
    instrumentor = LangChainInstrumentor()
    instrumentor.instrument(tracer_provider=tracer_provider)
    try:
        result = GraphMultiAgentRecorder(exporter).record(
            "graph-session",
            "a delivery estimate",
            tmp_path / "traces.jsonl",
        )
    finally:
        instrumentor.uninstrument()
        tracer_provider.shutdown()

    assert result.answer.endswith("Standard delivery is four to six business days.")
    assert result.handoffs == (
        "research_agent->writer_agent",
        "supervisor_agent->writer_agent",
    )
    assert len(result.handoffs) == MAX_HANDOFFS
    assert len(result.trace_ids) == 1
    assert (tmp_path / "traces.jsonl").is_file()

    spans = exporter.spans_since(0)
    by_name = {span.name: span for span in spans}
    assert {
        "supervisor_agent",
        "research_policy_node",
        "research_agent",
        "writer_response_node",
        "writer_agent",
    }.issubset(by_name)
    assert all(span.attributes["session.id"] == "graph-session" for span in spans)
    assert (
        by_name["research_agent"].parent.span_id == by_name["research_policy_node"].context.span_id
    )
    assert by_name["writer_agent"].parent.span_id == by_name["writer_response_node"].context.span_id
    kinds = {span.attributes.get("openinference.span.kind") for span in spans}
    assert "AGENT" in kinds
    assert "CHAIN" in kinds

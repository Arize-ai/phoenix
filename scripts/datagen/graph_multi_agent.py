#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "langchain-core==1.5.6",
#   "openinference-instrumentation==0.1.57",
#   "openinference-instrumentation-langchain==0.1.70",
#   "opentelemetry-exporter-otlp-proto-common==1.44.0",
#   "opentelemetry-sdk==1.44.0",
#   "protobuf==7.35.1",
# ]
# ///
"""Record fixed multi-agent graph fixtures through LangChain callbacks."""

from __future__ import annotations

import argparse
from collections.abc import Mapping, Sequence
from pathlib import Path
from typing import TYPE_CHECKING, Any, cast

from langchain_core.runnables import RunnableLambda
from openinference.instrumentation import (
    OITracer,
    TraceConfig,
    get_attributes_from_context,
    using_session,
)
from openinference.instrumentation.langchain import LangChainInstrumentor
from openinference.semconv.trace import OpenInferenceMimeTypeValues, OpenInferenceSpanKindValues
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import ReadableSpan, Span, SpanProcessor, TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor

if TYPE_CHECKING or __package__:
    from scripts.datagen.conditions import materialize_condition
    from scripts.datagen.recording import (
        RecorderFixture,
        SpanCaptureExporter,
        append_spans,
        fixtures_for,
        prepare_recording,
        record_fixture,
        trace_ids,
    )
else:
    from conditions import materialize_condition
    from recording import (
        RecorderFixture,
        SpanCaptureExporter,
        append_spans,
        fixtures_for,
        prepare_recording,
        record_fixture,
        trace_ids,
    )


class OpenInferenceContextSpanProcessor(SpanProcessor):
    """Apply the active session to spans started by LangChain callbacks."""

    def on_start(self, span: Span, parent_context: Any = None) -> None:
        span.set_attributes(dict(get_attributes_from_context()))

    def on_end(self, span: ReadableSpan) -> None:
        pass

    def shutdown(self) -> None:
        pass


class GraphMultiAgentRecorder:
    def __init__(self, exporter: SpanCaptureExporter, tracer: OITracer) -> None:
        self._exporter = exporter
        self._tracer = tracer

    def record(self, fixture: RecorderFixture, traces_path: Path) -> tuple[str, ...]:
        prompt = fixture.inputs.get("prompt")
        documents = fixture.inputs.get("documents")
        if not isinstance(prompt, str) or not isinstance(documents, list) or not documents:
            raise ValueError(f"fixture {fixture.fragment_id!r} has invalid graph inputs")
        checkpoint = self._exporter.checkpoint()

        def research(state: Mapping[str, Any]) -> dict[str, Any]:
            evidence = " ".join(
                str(document.get("text", ""))
                for document in documents
                if isinstance(document, dict)
            )
            return {**state, "evidence": evidence}

        def write(state: Mapping[str, Any]) -> dict[str, Any]:
            if "ack-timeout" in fixture.fragment_id:
                raise RuntimeError("writer could not validate the acknowledgement boundary")
            return {**state, "answer": f"{state['prompt']}: {state['evidence']}"}

        researcher = RunnableLambda(research).with_config({"run_name": "research_agent"})
        writer = RunnableLambda(write).with_config({"run_name": "writer_agent"})

        def supervise(state: Mapping[str, Any]) -> dict[str, Any]:
            return cast(dict[str, Any], writer.invoke(researcher.invoke(state)))

        graph = RunnableLambda(supervise).with_config({"run_name": "supervisor_agent"})
        try:
            with using_session(fixture.fragment_id):
                with self._tracer.start_as_current_span(
                    "coordinate_research_request",
                    openinference_span_kind=OpenInferenceSpanKindValues.AGENT,
                ) as root_span:
                    root_span.set_input(prompt, mime_type=OpenInferenceMimeTypeValues.TEXT.value)
                    try:
                        result = graph.invoke({"prompt": prompt})
                    except RuntimeError as error:
                        if "ack-timeout" not in fixture.fragment_id:
                            raise
                        output = f"Unable to complete the request: {error}"
                    else:
                        output = str(result["answer"])
                    root_span.set_output(
                        output,
                        mime_type=OpenInferenceMimeTypeValues.TEXT.value,
                    )
        finally:
            spans = self._exporter.spans_since(checkpoint)
            if spans:
                append_spans(traces_path, spans)
        return trace_ids(spans)


def record(
    output_dir: Path,
    *,
    fixtures: Sequence[RecorderFixture] | None = None,
    condition: str | None = None,
    append: bool = False,
) -> tuple[dict[str, Any], ...]:
    """Record every selected graph fixture into a corpus directory."""
    if condition is not None and fixtures is not None:
        raise ValueError("condition and fixtures cannot be selected together")
    if condition is not None:
        conditioned = materialize_condition(condition)
        if conditioned.fixture.archetype != "graph_multi_agent":
            raise ValueError(f"condition {condition!r} does not select a graph fixture")
        selected_fixtures: Sequence[RecorderFixture] = (conditioned.fixture,)
    else:
        selected_fixtures = fixtures_for("graph_multi_agent", fixtures=fixtures)
    prepare_recording(output_dir, append=append)
    exporter = SpanCaptureExporter()
    provider = TracerProvider(
        resource=Resource.create({"service.name": "datagen.graph_multi_agent"})
    )
    provider.add_span_processor(OpenInferenceContextSpanProcessor())
    provider.add_span_processor(SimpleSpanProcessor(cast(Any, exporter)))
    tracer = OITracer(provider.get_tracer(__name__), TraceConfig())
    instrumentor = LangChainInstrumentor()
    instrumentor.instrument(tracer_provider=provider)
    fragments = []
    try:
        recorder = GraphMultiAgentRecorder(exporter, tracer)
        for fixture in selected_fixtures:
            fragments.append(record_fixture(fixture, output_dir, recorder.record))
    finally:
        instrumentor.uninstrument()
        provider.shutdown()
    return tuple(fragments)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--condition")
    parser.add_argument("--append", action="store_true")
    args = parser.parse_args()
    fragments = record(args.output_dir, condition=args.condition, append=args.append)
    print(f"Recorded {len(fragments)} graph fragments in {args.output_dir}")


if __name__ == "__main__":
    main()

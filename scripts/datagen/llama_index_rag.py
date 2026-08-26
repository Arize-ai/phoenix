#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "llama-index-core==0.14.23",
#   "llama-index-postprocessor-cohere-rerank==0.9.0",
#   "openinference-instrumentation==0.1.57",
#   "openinference-instrumentation-llama-index==4.4.5",
#   "opentelemetry-exporter-otlp-proto-common==1.44.0",
#   "opentelemetry-sdk==1.44.0",
#   "protobuf==7.35.1",
# ]
# ///
"""Record fixed RAG fixtures through the LlamaIndex instrumentor."""

from __future__ import annotations

import argparse
from collections.abc import Mapping, Sequence
from pathlib import Path
from typing import TYPE_CHECKING, Any, cast

from openinference.instrumentation import using_session
from openinference.instrumentation.llama_index import (  # type: ignore[import-not-found]
    LlamaIndexInstrumentor,
)
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor

if TYPE_CHECKING or __package__:
    from scripts.datagen.rag import build_rag_engine
    from scripts.datagen.recording import (
        RecorderFixture,
        SpanCaptureExporter,
        append_spans,
        fixtures_for,
        record_fixture,
        reset_recording,
        trace_ids,
        validate_recording,
    )
else:
    from rag import build_rag_engine
    from recording import (
        RecorderFixture,
        SpanCaptureExporter,
        append_spans,
        fixtures_for,
        record_fixture,
        reset_recording,
        trace_ids,
        validate_recording,
    )


def record(
    output_dir: Path,
    *,
    fixtures: Sequence[RecorderFixture] | None = None,
) -> tuple[dict[str, Any], ...]:
    """Record every selected RAG fixture into a corpus directory."""
    reset_recording(output_dir)
    exporter = SpanCaptureExporter()
    provider = TracerProvider(resource=Resource.create({"service.name": "datagen.rag"}))
    provider.add_span_processor(SimpleSpanProcessor(cast(Any, exporter)))
    instrumentor = LlamaIndexInstrumentor()
    instrumentor.instrument(tracer_provider=provider)

    def adapter(fixture: RecorderFixture, traces_path: Path) -> tuple[str, ...]:
        questions = fixture.inputs.get("questions")
        documents = fixture.inputs.get("documents")
        if (
            not isinstance(questions, list)
            or not all(isinstance(question, str) for question in questions)
            or not isinstance(documents, list)
            or not all(isinstance(document, Mapping) for document in documents)
        ):
            raise ValueError(f"fixture {fixture.fragment_id!r} has invalid RAG inputs")
        engine = build_rag_engine(cast(Sequence[Mapping[str, Any]], documents))
        checkpoint = exporter.checkpoint()
        try:
            with using_session(fixture.fragment_id):
                for question in questions:
                    engine.query(question)
        finally:
            spans = exporter.spans_since(checkpoint)
            if spans:
                append_spans(traces_path, spans)
        return trace_ids(spans)

    fragments = []
    try:
        for fixture in fixtures_for("rag", fixtures=fixtures):
            fragments.append(record_fixture(fixture, output_dir, adapter))
    finally:
        instrumentor.uninstrument()
        provider.shutdown()
    validate_recording(
        output_dir / "traces.jsonl",
        required_span_kinds=("CHAIN", "EMBEDDING", "RETRIEVER", "RERANKER", "LLM"),
        recorder_name="LlamaIndex instrumenter",
    )
    return tuple(fragments)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args()
    fragments = record(args.output_dir)
    print(f"Recorded {len(fragments)} RAG fragments in {args.output_dir}")


if __name__ == "__main__":
    main()

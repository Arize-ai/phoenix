#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "llama-index-core==0.14.23",
#   "llama-index-llms-openai==0.7.10",
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
import os
from collections.abc import Mapping, Sequence
from pathlib import Path
from typing import TYPE_CHECKING, Any, Literal, cast

from openinference.instrumentation import using_session
from openinference.instrumentation.llama_index import (  # type: ignore[import-not-found]
    LlamaIndexInstrumentor,
)
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor

if TYPE_CHECKING or __package__:
    from scripts.datagen.conditions import materialize_condition
    from scripts.datagen.rag import build_rag_engine
    from scripts.datagen.recording import (
        RecorderFixture,
        SpanCaptureExporter,
        append_spans,
        fixtures_for,
        prepare_recording,
        record_fixture,
        trace_ids,
        validate_recording,
    )
else:
    from conditions import materialize_condition
    from rag import build_rag_engine
    from recording import (
        RecorderFixture,
        SpanCaptureExporter,
        append_spans,
        fixtures_for,
        prepare_recording,
        record_fixture,
        trace_ids,
        validate_recording,
    )

Provider = Literal["scripted", "live"]


def record(
    output_dir: Path,
    *,
    fixtures: Sequence[RecorderFixture] | None = None,
    condition: str | None = None,
    append: bool = False,
    provider: Provider = "scripted",
    model: str | None = None,
    live_llm: Any = None,
) -> tuple[dict[str, Any], ...]:
    """Record every selected RAG fixture into a corpus directory."""
    if provider not in ("scripted", "live"):
        raise ValueError(f"unknown RAG provider {provider!r}")
    if condition is not None and fixtures is not None:
        raise ValueError("condition and fixtures cannot be selected together")
    if provider == "live" and not model:
        raise ValueError("live RAG recording requires an explicit model")
    if provider == "live" and live_llm is None:
        api_key = os.environ.get("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("live RAG recording requires OPENAI_API_KEY")
        from llama_index.llms.openai import OpenAI  # type: ignore[import-not-found]

        llm_args: dict[str, Any] = {"model": model, "api_key": api_key}
        if base_url := os.environ.get("OPENAI_BASE_URL"):
            llm_args["api_base"] = base_url
        live_llm = OpenAI(**llm_args)
    if condition is not None:
        conditioned = materialize_condition(condition)
        if conditioned.fixture.archetype != "rag":
            raise ValueError(f"condition {condition!r} does not select a RAG fixture")
        selected_fixtures: Sequence[RecorderFixture] = (conditioned.fixture,)
    else:
        selected_fixtures = fixtures_for("rag", fixtures=fixtures)
    prepare_recording(output_dir, append=append)
    exporter = SpanCaptureExporter()
    tracer_provider = TracerProvider(resource=Resource.create({"service.name": "datagen.rag"}))
    tracer_provider.add_span_processor(SimpleSpanProcessor(cast(Any, exporter)))
    instrumentor = LlamaIndexInstrumentor()
    instrumentor.instrument(tracer_provider=tracer_provider)

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
        engine = build_rag_engine(
            cast(Sequence[Mapping[str, Any]], documents),
            llm=live_llm if provider == "live" else None,
        )
        checkpoint = exporter.checkpoint()
        try:
            with using_session(fixture.fragment_id):
                for question in questions:
                    engine.query(question)
        except Exception:
            if provider == "scripted":
                raise
        finally:
            spans = exporter.spans_since(checkpoint)
            if spans:
                append_spans(traces_path, spans)
        return trace_ids(spans)

    fragments = []
    try:
        for fixture in selected_fixtures:
            fragments.append(record_fixture(fixture, output_dir, adapter))
    finally:
        instrumentor.uninstrument()
        tracer_provider.shutdown()
    if provider == "scripted":
        validate_recording(
            output_dir / "traces.jsonl",
            required_span_kinds=("CHAIN", "EMBEDDING", "RETRIEVER", "RERANKER", "LLM"),
            recorder_name="LlamaIndex instrumenter",
        )
    return tuple(fragments)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--condition")
    parser.add_argument("--append", action="store_true")
    parser.add_argument("--provider", choices=("scripted", "live"), default="scripted")
    parser.add_argument("--model")
    args = parser.parse_args()
    fragments = record(
        args.output_dir,
        condition=args.condition,
        append=args.append,
        provider=args.provider,
        model=args.model,
    )
    print(f"Recorded {len(fragments)} RAG fragments in {args.output_dir}")


if __name__ == "__main__":
    main()

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
"""Record local RAG conversations as OTLP protobuf JSON lines."""

from __future__ import annotations

import argparse
import importlib.metadata
import json
from collections.abc import Mapping, Sequence
from pathlib import Path

from google.protobuf.json_format import MessageToJson
from opentelemetry.exporter.otlp.proto.common.trace_encoder import encode_spans
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import ReadableSpan, TracerProvider
from opentelemetry.sdk.trace.export import (
    SimpleSpanProcessor,
    SpanExporter,
    SpanExportResult,
)

if __package__:
    from scripts.datagen.recording import validate_recording
else:
    from recording import validate_recording  # type: ignore[import-not-found,no-redef]

SCENARIO_NAME = "langchain_agent_rag"
REQUIRED_SPAN_KINDS = frozenset({"CHAIN", "EMBEDDING", "RETRIEVER", "RERANKER", "LLM"})


class JsonlOtlpExporter(SpanExporter):  # type: ignore[misc]
    def __init__(self, path: Path) -> None:
        self._path = path
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text("")

    def export(self, spans: Sequence[ReadableSpan]) -> SpanExportResult:
        request = encode_spans(spans)
        payload = json.loads(MessageToJson(request, indent=None))
        with self._path.open("a") as output:
            output.write(json.dumps(payload, separators=(",", ":")) + "\n")
        return SpanExportResult.SUCCESS


def write_manifest(output_dir: Path, sessions: Mapping[str, Sequence[str]]) -> None:
    spans, kinds = validate_recording(
        output_dir / "traces.jsonl",
        required_span_kinds=REQUIRED_SPAN_KINDS,
        recorder_name="RAG instrumenter",
    )
    manifest = {
        "schema_version": 2,
        "scenario_name": SCENARIO_NAME,
        "instrumenter_package_versions": {
            package: importlib.metadata.version(package)
            for package in (
                "openinference-instrumentation-llama-index",
                "openinference-semantic-conventions",
            )
        },
        "trace_count": len({span["traceId"] for span in spans}),
        "span_count": len(spans),
        "span_kinds": sorted(kinds),
        "session_structure": {
            "session_count": len(sessions),
            "turns_per_session": {session_id: len(turns) for session_id, turns in sessions.items()},
        },
        "encoding_notes": (
            "Each line is one protobuf-JSON ExportTraceServiceRequest. A "
            "SimpleSpanProcessor exports one completed span per request, so "
            "spans from the same trace can occupy separate lines."
        ),
    }
    (output_dir / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")


def record(output_dir: Path) -> None:
    from openinference.instrumentation import using_session
    from openinference.instrumentation.llama_index import LlamaIndexInstrumentor
    from rag import SESSIONS, build_rag_engine

    provider = TracerProvider(
        resource=Resource.create({"service.name": f"datagen.{SCENARIO_NAME}"})
    )
    provider.add_span_processor(SimpleSpanProcessor(JsonlOtlpExporter(output_dir / "traces.jsonl")))
    instrumentor = LlamaIndexInstrumentor()
    instrumentor.instrument(tracer_provider=provider)
    try:
        for session_id, turns in SESSIONS.items():
            with using_session(session_id):
                engine = build_rag_engine()
                for turn in turns:
                    engine.query(turn)
    finally:
        instrumentor.uninstrument()
        provider.shutdown()
    write_manifest(output_dir, SESSIONS)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    default_output = Path(__file__).resolve().parents[2] / "dist/datagen-assets" / SCENARIO_NAME
    parser.add_argument("--output-dir", type=Path, default=default_output)
    args = parser.parse_args()

    record(args.output_dir)
    print(f"Recorded {SCENARIO_NAME} in {args.output_dir}")


if __name__ == "__main__":
    main()

#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "httpx==0.28.1",
#   "openai==2.54.0",
#   "openinference-instrumentation-openai==0.1.54",
#   "opentelemetry-exporter-otlp-proto-common==1.44.0",
#   "opentelemetry-sdk==1.44.0",
#   "protobuf==7.35.1",
# ]
# ///
"""Record multi-session OpenAI chat traces as OTLP protobuf JSON lines."""

from __future__ import annotations

import argparse
import importlib.metadata
import json
import os
from pathlib import Path
from typing import Any, Sequence

import httpx
from google.protobuf.json_format import MessageToJson
from openai import OpenAI
from openinference.instrumentation import using_session
from openinference.instrumentation.openai import OpenAIInstrumentor
from opentelemetry.exporter.otlp.proto.common.trace_encoder import encode_spans
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import ReadableSpan, TracerProvider
from opentelemetry.sdk.trace.export import (
    SimpleSpanProcessor,
    SpanExporter,
    SpanExportResult,
)

SCENARIO_NAME = "openai_chat_sessions"
SESSIONS = {
    "product-onboarding": (
        "Our new-team activation rate fell after we changed onboarding. "
        "Where should I start?",
        "Which assumption in that diagnosis is the riskiest?",
        "Design a small experiment to test it without rebuilding the entire flow.",
        "Summarize the recommendation as an owner, success bar, and review date.",
    ),
    "api-latency-incident": (
        "API p95 latency doubled while the median stayed flat. "
        "How should we investigate?",
        "Which metrics belong together on the incident dashboard?",
        "Give me the leading cause hypothesis and the evidence that would confirm it.",
        "Draft a concise stakeholder update while we test that hypothesis.",
    ),
    "community-garden": (
        "Help me plan a three-hour community garden workday for 18 volunteers.",
        "How should the plan change if rain is likely that morning?",
        "What materials should volunteers bring, and what should organizers provide?",
        "Write a short reminder email that includes the rain plan.",
    ),
}


class JsonlOtlpExporter(SpanExporter):
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


def _iter_spans(payload: dict[str, Any]) -> list[dict[str, Any]]:
    return [
        span
        for resource_spans in payload.get("resourceSpans", [])
        for scope_spans in resource_spans.get("scopeSpans", [])
        for span in scope_spans.get("spans", [])
    ]


def _attribute(span: dict[str, Any], key: str) -> Any:
    for attribute in span.get("attributes", []):
        if attribute.get("key") == key:
            return next(iter(attribute.get("value", {}).values()), None)
    return None


def write_manifest(output_dir: Path) -> None:
    spans = [
        span
        for line in (output_dir / "traces.jsonl").read_text().splitlines()
        for span in _iter_spans(json.loads(line))
    ]
    manifest = {
        "scenario_name": SCENARIO_NAME,
        "instrumenter_package_versions": {
            package: importlib.metadata.version(package)
            for package in (
                "openinference-instrumentation-openai",
                "openinference-semantic-conventions",
            )
        },
        "trace_count": len({span["traceId"] for span in spans}),
        "span_count": len(spans),
        "span_kinds": sorted(
            {
                kind
                for span in spans
                if (kind := _attribute(span, "openinference.span.kind"))
            }
        ),
        "session_structure": {
            "session_count": len(SESSIONS),
            "turns_per_session": {
                session_id: len(turns) for session_id, turns in SESSIONS.items()
            },
        },
        "encoding_notes": (
            "Each line is one protobuf-JSON ExportTraceServiceRequest. A "
            "SimpleSpanProcessor exports one completed span per request, so "
            "spans from the same trace can occupy separate lines."
        ),
    }
    (output_dir / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")


def in_process_http_client() -> httpx.Client:
    from mock_openai_provider import create_chat_completion

    def handle(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200, json=create_chat_completion(json.loads(request.content))
        )

    return httpx.Client(transport=httpx.MockTransport(handle))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    default_output = (
        Path(__file__).resolve().parents[2]
        / "src/phoenix/datagen/corpora"
        / SCENARIO_NAME
    )
    parser.add_argument("--output-dir", type=Path, default=default_output)
    parser.add_argument(
        "--base-url", default=os.getenv("OPENAI_BASE_URL", "http://127.0.0.1:8765/v1")
    )
    parser.add_argument(
        "--in-process-provider", action="store_true", help=argparse.SUPPRESS
    )
    args = parser.parse_args()

    provider = TracerProvider(
        resource=Resource.create({"service.name": f"datagen.{SCENARIO_NAME}"})
    )
    exporter = JsonlOtlpExporter(args.output_dir / "traces.jsonl")
    provider.add_span_processor(SimpleSpanProcessor(exporter))
    OpenAIInstrumentor().instrument(tracer_provider=provider)

    client = OpenAI(
        base_url=args.base_url,
        api_key=os.getenv("OPENAI_API_KEY", "datagen-dummy-key"),
        http_client=in_process_http_client() if args.in_process_provider else None,
    )
    for session_id, turns in SESSIONS.items():
        messages: list[dict[str, str]] = []
        with using_session(session_id):
            for turn in turns:
                messages.append({"role": "user", "content": turn})
                response = client.chat.completions.create(
                    model="gpt-4.1-mini", messages=messages
                )
                messages.append(
                    {
                        "role": "assistant",
                        "content": response.choices[0].message.content or "",
                    }
                )

    provider.shutdown()
    write_manifest(args.output_dir)
    print(f"Recorded {SCENARIO_NAME} in {args.output_dir}")


if __name__ == "__main__":
    main()

#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "httpx==0.28.1",
#   "openai==3.2.0",
#   "openinference-instrumentation==0.1.57",
#   "openinference-instrumentation-openai==0.1.54",
#   "opentelemetry-exporter-otlp-proto-common==1.44.0",
#   "opentelemetry-sdk==1.44.0",
#   "protobuf==7.35.1",
# ]
# ///
"""Record fixed analytics extractions through instrumented OpenAI calls."""

from __future__ import annotations

import argparse
import json
from collections.abc import Mapping, Sequence
from pathlib import Path
from typing import TYPE_CHECKING, Any, cast

from openai import OpenAI
from openinference.instrumentation import using_session
from openinference.instrumentation.openai import OpenAIInstrumentor
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor

if TYPE_CHECKING or __package__:
    from scripts.datagen.mock_openai_provider import ScriptedOpenAIProvider
    from scripts.datagen.recording import (
        RecorderFixture,
        SpanCaptureExporter,
        append_spans,
        fixtures_for,
        record_fixture,
        reset_recording,
        trace_ids,
    )
else:
    from mock_openai_provider import ScriptedOpenAIProvider
    from recording import (
        RecorderFixture,
        SpanCaptureExporter,
        append_spans,
        fixtures_for,
        record_fixture,
        reset_recording,
        trace_ids,
    )

EXTRACTION_TOOL = {
    "type": "function",
    "function": {
        "name": "extract_analysis_request",
        "description": "Extract an analytics request into a stable execution brief.",
        "strict": True,
        "parameters": {
            "type": "object",
            "additionalProperties": False,
            "properties": {
                "purpose": {"type": "string"},
                "metrics": {"type": "array", "items": {"type": "string"}},
                "dimensions": {"type": "array", "items": {"type": "string"}},
                "unresolved": {"type": "array", "items": {"type": "string"}},
                "format": {"type": "string"},
            },
            "required": ["purpose", "metrics", "dimensions", "unresolved", "format"],
        },
    },
}


def record(
    output_dir: Path,
    *,
    fixtures: Sequence[RecorderFixture] | None = None,
) -> tuple[dict[str, Any], ...]:
    """Record every selected extraction fixture into a corpus directory."""
    reset_recording(output_dir)
    exporter = SpanCaptureExporter()
    provider = TracerProvider(
        resource=Resource.create({"service.name": "datagen.structured_extraction"})
    )
    provider.add_span_processor(SimpleSpanProcessor(cast(Any, exporter)))
    instrumentor = OpenAIInstrumentor()
    instrumentor.instrument(tracer_provider=provider)
    fragments = []
    try:
        for fixture in fixtures_for("structured_extraction", fixtures=fixtures):
            fragments.append(
                record_fixture(
                    fixture,
                    output_dir,
                    lambda selected, traces_path: _record_fixture(selected, traces_path, exporter),
                )
            )
    finally:
        instrumentor.uninstrument()
        provider.shutdown()
    return tuple(fragments)


def _record_fixture(
    fixture: RecorderFixture,
    traces_path: Path,
    exporter: SpanCaptureExporter,
) -> tuple[str, ...]:
    text = fixture.inputs.get("text")
    expected = fixture.inputs.get("result")
    if not isinstance(text, str) or not isinstance(expected, Mapping):
        raise ValueError(f"fixture {fixture.fragment_id!r} has invalid extraction inputs")
    arguments = dict(expected)
    arguments.setdefault("unresolved", [])
    scripted = ScriptedOpenAIProvider(
        ({"tool_call": {"name": "extract_analysis_request", "arguments": arguments}},)
    )
    client = OpenAI(
        api_key="datagen-dummy-key",
        base_url="https://datagen.test/v1",
        http_client=cast(Any, scripted.http_client()),
        max_retries=0,
    )
    checkpoint = exporter.checkpoint()
    try:
        with using_session(fixture.fragment_id):
            response = client.chat.completions.create(
                model="datagen-scripted",
                messages=[{"role": "user", "content": text}],
                tools=cast(Any, [EXTRACTION_TOOL]),
                tool_choice={
                    "type": "function",
                    "function": {"name": "extract_analysis_request"},
                },
            )
    finally:
        spans = exporter.spans_since(checkpoint)
        if spans:
            append_spans(traces_path, spans)
    calls = response.choices[0].message.tool_calls
    if calls is None or len(calls) != 1:
        raise ValueError(f"fixture {fixture.fragment_id!r} returned no extraction")
    call = cast(Any, calls[0])
    if json.loads(call.function.arguments) != arguments:
        raise ValueError(f"fixture {fixture.fragment_id!r} returned an unexpected extraction")
    return trace_ids(spans)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args()
    fragments = record(args.output_dir)
    print(f"Recorded {len(fragments)} structured-extraction fragments in {args.output_dir}")


if __name__ == "__main__":
    main()

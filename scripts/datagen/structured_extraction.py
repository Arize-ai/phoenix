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
import os
from collections.abc import Mapping, Sequence
from pathlib import Path
from typing import TYPE_CHECKING, Any, Literal, cast

from openai import OpenAI
from openinference.instrumentation import using_session
from openinference.instrumentation.openai import OpenAIInstrumentor
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor

if TYPE_CHECKING or __package__:
    from scripts.datagen.conditions import materialize_condition
    from scripts.datagen.mock_openai_provider import ScriptedOpenAIProvider
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
    from mock_openai_provider import ScriptedOpenAIProvider
    from recording import (
        RecorderFixture,
        SpanCaptureExporter,
        append_spans,
        fixtures_for,
        prepare_recording,
        record_fixture,
        trace_ids,
    )

Provider = Literal["scripted", "live"]

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
    condition: str | None = None,
    append: bool = False,
    provider: Provider = "scripted",
    model: str | None = None,
    live_client: OpenAI | None = None,
) -> tuple[dict[str, Any], ...]:
    """Record every selected extraction fixture into a corpus directory."""
    if provider not in ("scripted", "live"):
        raise ValueError(f"unknown extraction provider {provider!r}")
    if condition is not None and fixtures is not None:
        raise ValueError("condition and fixtures cannot be selected together")
    if provider == "live" and not model:
        raise ValueError("live extraction recording requires an explicit model")
    if provider == "live" and live_client is None:
        api_key = os.environ.get("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("live extraction recording requires OPENAI_API_KEY")
        client_args: dict[str, Any] = {"api_key": api_key, "max_retries": 0}
        if base_url := os.environ.get("OPENAI_BASE_URL"):
            client_args["base_url"] = base_url
        live_client = OpenAI(**client_args)
    if condition is not None:
        conditioned = materialize_condition(condition)
        if conditioned.fixture.archetype != "structured_extraction":
            raise ValueError(f"condition {condition!r} does not select an extraction fixture")
        selected_fixtures: Sequence[RecorderFixture] = (conditioned.fixture,)
    else:
        selected_fixtures = fixtures_for("structured_extraction", fixtures=fixtures)
    prepare_recording(output_dir, append=append)
    exporter = SpanCaptureExporter()
    tracer_provider = TracerProvider(
        resource=Resource.create({"service.name": "datagen.structured_extraction"})
    )
    tracer_provider.add_span_processor(SimpleSpanProcessor(cast(Any, exporter)))
    instrumentor = OpenAIInstrumentor()
    instrumentor.instrument(tracer_provider=tracer_provider)
    fragments = []
    try:
        for fixture in selected_fixtures:
            fragments.append(
                record_fixture(
                    fixture,
                    output_dir,
                    lambda selected, traces_path: _record_fixture(
                        selected,
                        traces_path,
                        exporter,
                        provider=provider,
                        model=model,
                        live_client=live_client,
                    ),
                )
            )
    finally:
        instrumentor.uninstrument()
        tracer_provider.shutdown()
    return tuple(fragments)


def _record_fixture(
    fixture: RecorderFixture,
    traces_path: Path,
    exporter: SpanCaptureExporter,
    *,
    provider: Provider,
    model: str | None,
    live_client: OpenAI | None,
) -> tuple[str, ...]:
    text = fixture.inputs.get("text")
    expected = fixture.inputs.get("result")
    if not isinstance(text, str) or not isinstance(expected, Mapping):
        raise ValueError(f"fixture {fixture.fragment_id!r} has invalid extraction inputs")
    arguments = dict(expected)
    arguments.setdefault("unresolved", [])
    if provider == "scripted":
        scripted = ScriptedOpenAIProvider(
            ({"tool_call": {"name": "extract_analysis_request", "arguments": arguments}},)
        )
        client = OpenAI(
            api_key="datagen-dummy-key",
            base_url="https://datagen.test/v1",
            http_client=cast(Any, scripted.http_client()),
            max_retries=0,
        )
        model_name = "datagen-scripted"
    else:
        client = cast(OpenAI, live_client)
        model_name = cast(str, model)
    checkpoint = exporter.checkpoint()
    try:
        with using_session(fixture.fragment_id):
            response = client.chat.completions.create(
                model=model_name,
                messages=[{"role": "user", "content": text}],
                tools=cast(Any, [EXTRACTION_TOOL]),
                tool_choice={
                    "type": "function",
                    "function": {"name": "extract_analysis_request"},
                },
            )
    except Exception:
        if provider == "scripted":
            raise
        response = None
    finally:
        spans = exporter.spans_since(checkpoint)
        if spans:
            append_spans(traces_path, spans)
    if provider == "scripted":
        calls = cast(Any, response).choices[0].message.tool_calls
        if calls is None or len(calls) != 1:
            raise ValueError(f"fixture {fixture.fragment_id!r} returned no extraction")
        call = cast(Any, calls[0])
        if json.loads(call.function.arguments) != arguments:
            raise ValueError(f"fixture {fixture.fragment_id!r} returned an unexpected extraction")
    return trace_ids(spans)


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
    print(f"Recorded {len(fragments)} structured-extraction fragments in {args.output_dir}")


if __name__ == "__main__":
    main()

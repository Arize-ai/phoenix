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
"""Record fixed plain-chat fixtures through the OpenAI instrumentor."""

from __future__ import annotations

import argparse
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


def record(
    output_dir: Path,
    *,
    fixtures: Sequence[RecorderFixture] | None = None,
) -> tuple[dict[str, Any], ...]:
    """Record every selected plain-chat fixture into a corpus directory."""
    reset_recording(output_dir)
    exporter = SpanCaptureExporter()
    provider = TracerProvider(resource=Resource.create({"service.name": "datagen.plain_chat"}))
    provider.add_span_processor(SimpleSpanProcessor(cast(Any, exporter)))
    instrumentor = OpenAIInstrumentor()
    instrumentor.instrument(tracer_provider=provider)
    fragments = []
    try:
        for fixture in fixtures_for("plain_chat", fixtures=fixtures):
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
    scripted = ScriptedOpenAIProvider.for_fixture(fixture)
    client = OpenAI(
        api_key="datagen-dummy-key",
        base_url="https://datagen.test/v1",
        http_client=cast(Any, scripted.http_client()),
        max_retries=0,
    )
    turns = fixture.inputs.get("turns")
    if not isinstance(turns, list):
        raise ValueError(f"fixture {fixture.fragment_id!r} has no chat turns")
    messages: list[Mapping[str, Any]] = []
    checkpoint = exporter.checkpoint()
    try:
        with using_session(fixture.fragment_id):
            for turn in turns:
                if not isinstance(turn, dict):
                    raise ValueError(f"fixture {fixture.fragment_id!r} has an invalid turn")
                user = turn.get("user")
                expected = turn.get("assistant")
                if not isinstance(user, str) or not isinstance(expected, str):
                    raise ValueError(f"fixture {fixture.fragment_id!r} has an invalid turn")
                messages.append({"role": "user", "content": user})
                response = client.chat.completions.create(
                    model="datagen-scripted",
                    messages=cast(Any, messages),
                )
                content = response.choices[0].message.content
                if content != expected:
                    raise ValueError(f"fixture {fixture.fragment_id!r} returned unexpected content")
                messages.append({"role": "assistant", "content": content})
    finally:
        spans = exporter.spans_since(checkpoint)
        if spans:
            append_spans(traces_path, spans)
    return trace_ids(spans)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args()
    fragments = record(args.output_dir)
    print(f"Recorded {len(fragments)} plain-chat fragments in {args.output_dir}")


if __name__ == "__main__":
    main()

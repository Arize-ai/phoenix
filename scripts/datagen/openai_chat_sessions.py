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

_IMPERFECT_USER_PROMPT = (
    "You are an imperfect human continuing the conversation. Reply with only the next user "
    "message: terse, sometimes vague or typo-prone, occasionally correcting a detail, and free "
    "to shift goals. Do not label the speaker or explain the simulation."
)


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
    """Record every selected plain-chat fixture into a corpus directory."""
    if provider not in ("scripted", "live"):
        raise ValueError(f"unknown plain-chat provider {provider!r}")
    if condition is not None and fixtures is not None:
        raise ValueError("condition and fixtures cannot be selected together")
    if provider == "live" and not model:
        raise ValueError("live plain-chat recording requires an explicit model")
    if provider == "live" and live_client is None:
        api_key = os.environ.get("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("live plain-chat recording requires OPENAI_API_KEY")
        client_args: dict[str, Any] = {"api_key": api_key, "max_retries": 0}
        if base_url := os.environ.get("OPENAI_BASE_URL"):
            client_args["base_url"] = base_url
        live_client = OpenAI(**client_args)
    if condition is not None:
        conditioned = materialize_condition(condition)
        if conditioned.fixture.archetype != "plain_chat":
            raise ValueError(f"condition {condition!r} does not select a plain-chat fixture")
        selected_fixtures: Sequence[RecorderFixture] = (conditioned.fixture,)
    else:
        selected_fixtures = fixtures_for("plain_chat", fixtures=fixtures)
    prepare_recording(output_dir, append=append)
    exporter = SpanCaptureExporter()
    tracer_provider = TracerProvider(
        resource=Resource.create({"service.name": "datagen.plain_chat"})
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
    if provider == "scripted":
        scripted = ScriptedOpenAIProvider.for_fixture(fixture)
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
    turns = fixture.inputs.get("turns")
    if not isinstance(turns, list):
        raise ValueError(f"fixture {fixture.fragment_id!r} has no chat turns")
    messages: list[Mapping[str, Any]] = []
    checkpoint = exporter.checkpoint()
    try:
        with using_session(fixture.fragment_id):
            for turn_index, turn in enumerate(turns):
                if not isinstance(turn, dict):
                    raise ValueError(f"fixture {fixture.fragment_id!r} has an invalid turn")
                user = turn.get("user")
                expected = turn.get("assistant")
                if provider == "scripted" and (
                    not isinstance(user, str) or not isinstance(expected, str)
                ):
                    raise ValueError(f"fixture {fixture.fragment_id!r} has an invalid turn")
                if provider == "live" and turn_index > 0:
                    user = _simulate_user(client, model_name, messages)
                if not isinstance(user, str):
                    if provider == "scripted" or turn_index == 0:
                        raise ValueError(f"fixture {fixture.fragment_id!r} has an invalid turn")
                    break
                messages.append({"role": "user", "content": user})
                response = client.chat.completions.create(
                    model=model_name,
                    messages=cast(Any, messages),
                )
                content = response.choices[0].message.content
                if provider == "scripted" and content != expected:
                    raise ValueError(f"fixture {fixture.fragment_id!r} returned unexpected content")
                if not isinstance(content, str):
                    break
                messages.append({"role": "assistant", "content": content})
    except Exception:
        if provider == "scripted":
            raise
    finally:
        spans = exporter.spans_since(checkpoint)
        if spans:
            append_spans(traces_path, spans)
    return trace_ids(spans)


def _simulate_user(
    client: OpenAI,
    model: str,
    messages: Sequence[Mapping[str, Any]],
) -> str | None:
    response = client.chat.completions.create(
        model=model,
        messages=cast(
            Any,
            [{"role": "system", "content": _IMPERFECT_USER_PROMPT}, *messages],
        ),
    )
    return response.choices[0].message.content


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
    print(f"Recorded {len(fragments)} plain-chat fragments in {args.output_dir}")


if __name__ == "__main__":
    main()

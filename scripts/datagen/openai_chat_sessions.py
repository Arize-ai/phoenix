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
import random
from collections.abc import Mapping, Sequence
from dataclasses import replace
from math import log
from pathlib import Path
from typing import TYPE_CHECKING, Any, Literal, cast

from openai import OpenAI
from openinference.instrumentation import suppress_tracing, using_session
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
        resolve_live_model,
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
        resolve_live_model,
        trace_ids,
    )

Provider = Literal["scripted", "live"]

# Live conversations run until the simulated user is satisfied. The target
# steers how much conversation happens before the wind-down instruction is
# added; the actual ending is the simulated user closing without a further
# request. The hard cap only guards against a conversation that never closes.
_TARGET_TURNS_MEDIAN = 8.0
_TARGET_TURNS_SIGMA = 0.4
_TARGET_TURNS_MAX = 25

_WIND_DOWN_SUFFIX = (
    " Your remaining concerns are nearly addressed. When the assistant has "
    "answered your current question, close the conversation with a brief "
    "message of thanks or acknowledgement that asks nothing further. If "
    "something important is still unresolved, ask about it instead."
)


def _draw_target_turns(rng: random.Random) -> int:
    target = round(rng.lognormvariate(log(_TARGET_TURNS_MEDIAN), _TARGET_TURNS_SIGMA))
    return min(_TARGET_TURNS_MAX, max(2, target))


def _is_closing(message: str) -> bool:
    """A wind-down-phase user message with no question or request ends the session."""
    return "?" not in message


_DISPOSITION_PROMPTS: Mapping[str, str] = {
    "impatient": (
        "You are an imperfect human continuing the conversation. You are impatient and want a "
        "useful answer quickly, so press for specifics and skip pleasantries. Reply with only the "
        "next user message. Do not label the speaker or explain the simulation."
    ),
    "confused_novice": (
        "You are an imperfect human continuing the conversation. You are a confused novice who "
        "may misuse terms, ask basic follow-ups, or need an earlier point clarified. Reply with "
        "only the next user message. Do not label the speaker or explain the simulation."
    ),
    "terse_expert": (
        "You are an imperfect human continuing the conversation. You are a terse expert who uses "
        "precise domain language, omits context you assume is obvious, and corrects inaccuracies "
        "directly. Reply with only the next user message. Do not label the speaker or explain the "
        "simulation."
    ),
    "chatty": (
        "You are an imperfect human continuing the conversation. You are chatty and volunteer "
        "small contextual details, reactions, and side comments while pursuing the task. Reply "
        "with only the next user message. Do not label the speaker or explain the simulation."
    ),
    "frustrated": (
        "You are an imperfect human continuing the conversation. You are frustrated by the "
        "situation, show restrained annoyance, and challenge answers that do not resolve the "
        "problem. Reply with only the next user message. Do not label the speaker or explain the "
        "simulation."
    ),
    "distracted": (
        "You are an imperfect human continuing the conversation. You are distracted mid-task, so "
        "you may lose the thread, revise a detail, or abruptly return to an earlier concern. Reply "
        "with only the next user message. Do not label the speaker or explain the simulation."
    ),
}


def _with_opening_variant(fixture: RecorderFixture, rng: random.Random) -> RecorderFixture:
    """Pick one authored phrasing of the conversation's opening for this run."""
    variants = fixture.inputs.get("opening_variants")
    turns = fixture.inputs.get("turns")
    if not isinstance(variants, list) or not isinstance(turns, list) or not turns:
        return fixture
    first = turns[0]
    if not isinstance(first, dict) or not isinstance(first.get("user"), str):
        return fixture
    phrasings = [first["user"], *(v for v in variants if isinstance(v, str))]
    opening = rng.choice(phrasings)
    new_turns = [{**first, "user": opening}, *turns[1:]]
    return replace(fixture, inputs={**fixture.inputs, "turns": new_turns})


def record(
    output_dir: Path,
    *,
    fixtures: Sequence[RecorderFixture] | None = None,
    condition: str | None = None,
    append: bool = False,
    provider: Provider = "scripted",
    model: str | None = None,
    live_client: OpenAI | None = None,
    disposition: str | None = None,
    target_turns: int | None = None,
) -> tuple[dict[str, Any], ...]:
    """Record every selected plain-chat fixture into a corpus directory."""
    model = resolve_live_model(model)
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
    if disposition is not None and disposition not in _DISPOSITION_PROMPTS:
        raise ValueError(f"unknown plain-chat disposition {disposition!r}")
    disposition_prompts = (
        (_DISPOSITION_PROMPTS[disposition],)
        if disposition is not None
        else tuple(_DISPOSITION_PROMPTS.values())
    )
    length_rng = random.Random()
    opening_rng = random.Random()
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
        for fixture_index, fixture in enumerate(selected_fixtures):
            if provider == "live" and condition is None:
                fixture = _with_opening_variant(fixture, opening_rng)
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
                        disposition_prompt=disposition_prompts[
                            fixture_index % len(disposition_prompts)
                        ],
                        target_turns=target_turns or _draw_target_turns(length_rng),
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
    disposition_prompt: str,
    target_turns: int,
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
    if not isinstance(turns, list) or not turns:
        raise ValueError(f"fixture {fixture.fragment_id!r} has no chat turns")
    messages: list[Mapping[str, Any]] = []
    checkpoint = exporter.checkpoint()
    try:
        with using_session(fixture.fragment_id):
            if provider == "scripted":
                _run_scripted_turns(fixture, client, model_name, turns, messages)
            else:
                _run_live_conversation(
                    fixture,
                    client,
                    model_name,
                    turns,
                    messages,
                    disposition_prompt=disposition_prompt,
                    target_turns=target_turns,
                )
    except Exception:
        if provider == "scripted":
            raise
    finally:
        spans = exporter.spans_since(checkpoint)
        if spans:
            append_spans(traces_path, spans)
    return trace_ids(spans)


def _run_scripted_turns(
    fixture: RecorderFixture,
    client: OpenAI,
    model_name: str,
    turns: Sequence[Any],
    messages: list[Mapping[str, Any]],
) -> None:
    for turn in turns:
        if not isinstance(turn, dict):
            raise ValueError(f"fixture {fixture.fragment_id!r} has an invalid turn")
        user = turn.get("user")
        expected = turn.get("assistant")
        if not isinstance(user, str) or not isinstance(expected, str):
            raise ValueError(f"fixture {fixture.fragment_id!r} has an invalid turn")
        messages.append({"role": "user", "content": user})
        response = client.chat.completions.create(model=model_name, messages=cast(Any, messages))
        content = response.choices[0].message.content
        if content != expected:
            raise ValueError(f"fixture {fixture.fragment_id!r} returned unexpected content")
        messages.append({"role": "assistant", "content": content})


def _run_live_conversation(
    fixture: RecorderFixture,
    client: OpenAI,
    model_name: str,
    turns: Sequence[Any],
    messages: list[Mapping[str, Any]],
    *,
    disposition_prompt: str,
    target_turns: int,
) -> None:
    opening = turns[0].get("user") if isinstance(turns[0], dict) else None
    if not isinstance(opening, str):
        raise ValueError(f"fixture {fixture.fragment_id!r} has an invalid opening turn")
    hard_cap = max(target_turns * 2, target_turns + 3)
    user: str | None = opening
    for turn_index in range(hard_cap):
        winding_down = turn_index + 1 >= target_turns
        if turn_index > 0:
            prompt = disposition_prompt + (_WIND_DOWN_SUFFIX if winding_down else "")
            user = _simulate_user(client, model_name, messages, prompt)
        if not isinstance(user, str):
            break
        closing = turn_index > 0 and winding_down and _is_closing(user)
        messages.append({"role": "user", "content": user})
        response = client.chat.completions.create(model=model_name, messages=cast(Any, messages))
        content = response.choices[0].message.content
        if not isinstance(content, str):
            break
        messages.append({"role": "assistant", "content": content})
        if closing:
            break


def _simulate_user(
    client: OpenAI,
    model: str,
    messages: Sequence[Mapping[str, Any]],
    disposition_prompt: str,
) -> str | None:
    with suppress_tracing():
        response = client.chat.completions.create(
            model=model,
            messages=cast(
                Any,
                [{"role": "system", "content": disposition_prompt}, *messages],
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
    parser.add_argument("--disposition", choices=tuple(_DISPOSITION_PROMPTS))
    parser.add_argument(
        "--target-turns",
        type=int,
        help=(
            "Steer live conversations toward this many user turns; the ending "
            "still happens when the simulated user closes. Drawn per fixture "
            "when omitted."
        ),
    )
    args = parser.parse_args()
    fragments = record(
        args.output_dir,
        condition=args.condition,
        append=args.append,
        provider=args.provider,
        model=args.model,
        disposition=args.disposition,
        target_turns=args.target_turns,
    )
    print(f"Recorded {len(fragments)} plain-chat fragments in {args.output_dir}")


if __name__ == "__main__":
    main()

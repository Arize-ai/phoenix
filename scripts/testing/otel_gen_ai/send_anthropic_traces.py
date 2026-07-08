# /// script
# requires-python = ">=3.10"
# dependencies = [
#     "anthropic",
#     "opentelemetry-sdk",
#     "opentelemetry-exporter-otlp-proto-http",
#     "opentelemetry-instrumentation-anthropic",
#     "vcrpy==8.1.1",
# ]
# ///
"""Send Anthropic API traces to a local Phoenix at http://localhost:6006/v1/traces.

Run via:

    ANTHROPIC_API_KEY=sk-ant-... uv run --script \\
        scripts/testing/otel_gen_ai/send_anthropic_traces.py

Uses ``opentelemetry-instrumentation-anthropic`` (whatever's currently published
under that PyPI name). As of 2026-05 it emits the older flat-key gen_ai schema
(``gen_ai.prompt.{i}.role``, ``gen_ai.completion.{i}.role``, ``llm.usage.*``,
``gen_ai.request.model``, etc.) — useful for stress-testing Phoenix's normalizer.

Network payloads to api.anthropic.com are recorded via VCR (the lib pytest-recording
wraps) into ``scripts/testing/otel_gen_ai/cassettes/<span-name>.yaml`` (gitignored).
Auth/identity headers are scrubbed. Mode is ``once``: first run hits the live API,
subsequent runs replay the cassette. To force re-record, delete the cassette files.
Phoenix-bound OTLP traffic is excluded from recording via ``ignore_hosts``.

Override the endpoint with ``PHOENIX_ENDPOINT`` if your Phoenix isn't on :6006.
"""

from __future__ import annotations

import base64
import os
import sys
import urllib.request
from pathlib import Path
from urllib.parse import urlparse

import vcr
from anthropic import Anthropic
from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.anthropic import AnthropicInstrumentor
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from vcr.record_mode import RecordMode

PHOENIX_ENDPOINT = os.environ.get("PHOENIX_ENDPOINT", "http://localhost:6006/v1/traces")
MODEL = os.environ.get("ANTHROPIC_MODEL", "claude-opus-4-7")
CASSETTE_DIR = Path(__file__).resolve().parent / "cassettes"

# Don't record OTLP traffic to Phoenix — only the Anthropic API calls.
_phoenix_host = urlparse(PHOENIX_ENDPOINT).hostname or "localhost"
recorder = vcr.VCR(
    cassette_library_dir=str(CASSETTE_DIR),
    record_mode=RecordMode.ALL,
    decode_compressed_response=True,
    filter_headers=[
        ("x-api-key", "REDACTED"),
        ("authorization", "REDACTED"),
        ("anthropic-organization-id", "REDACTED"),
        ("cookie", "REDACTED"),
        ("set-cookie", "REDACTED"),
        ("cf-ray", "REDACTED"),
    ],
    ignore_hosts=[_phoenix_host],
)


def cassette(name: str):
    """Per-span cassette under cassettes/anthropic-<name>.yaml. The provider prefix
    keeps cassettes namespaced when sibling scripts (ADK Go, etc.) land here later."""
    return recorder.use_cassette(f"anthropic-{name}.yaml")


def main() -> int:
    if not os.environ.get("ANTHROPIC_API_KEY"):
        print("Set ANTHROPIC_API_KEY before running.", file=sys.stderr)
        return 1

    provider = TracerProvider(resource=Resource.create({"service.name": "anthropic-otel-demo"}))
    provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter(endpoint=PHOENIX_ENDPOINT)))
    trace.set_tracer_provider(provider)
    AnthropicInstrumentor().instrument()

    client = Anthropic()
    tracer = trace.get_tracer("anthropic-otel-demo")

    geography_system = "You are a terse geography expert. Answer in one word."
    weather_system = (
        "You are a helpful weather assistant. When the user asks about weather, "
        "call the get_weather tool, then summarize the result in one short sentence."
    )
    math_system = (
        "You are a meticulous number theorist. Verify each prime factor by "
        "multiplication before reporting the factorization."
    )
    research_system = (
        "You are a research assistant. Use the web_search tool to look up the "
        "answer, then summarize in one or two sentences with the source URL."
    )
    vision_system = "You are a concise nature observer. Identify the subject in one sentence."
    poet_system = "You are a haiku poet. Reply with exactly one haiku (3 lines)."

    # Plain chat — exercises gen_ai.prompt.*, gen_ai.completion.*, llm.usage.*
    with tracer.start_as_current_span("anthropic-plain-chat") as span, cassette("plain-chat"):
        print(f"trace_id={span.get_span_context().trace_id:032x}", file=sys.stderr)
        response = client.messages.create(
            model=MODEL,
            max_tokens=200,
            system=geography_system,
            output_config={"effort": "low"},
            messages=[{"role": "user", "content": "What's the capital of France?"}],
        )
        for block in response.content:
            print(getattr(block, "text", block))

    # Tool-use roundtrip — two API rounds: model emits tool_use, we send tool_result back.
    with tracer.start_as_current_span("anthropic-tool-use") as span, cassette("tool-use"):
        print(f"trace_id={span.get_span_context().trace_id:032x}", file=sys.stderr)
        tools = [
            {
                "name": "get_weather",
                "description": "Get the current weather in a given city.",
                "input_schema": {
                    "type": "object",
                    "properties": {"city": {"type": "string"}},
                    "required": ["city"],
                },
            }
        ]
        user_question = "What's the weather in San Francisco?"

        first = client.messages.create(
            model=MODEL,
            max_tokens=200,
            system=weather_system,
            tools=tools,
            output_config={"effort": "low"},
            messages=[{"role": "user", "content": user_question}],
        )
        print(f"round 1 stop_reason={first.stop_reason}")
        for block in first.content:
            print(block)

        # Mock tool execution; one tool_result per tool_use block in the model's reply.
        tool_results = [
            {
                "type": "tool_result",
                "tool_use_id": block.id,
                "content": "It's 65°F and foggy in San Francisco.",
            }
            for block in first.content
            if getattr(block, "type", None) == "tool_use"
        ]
        if not tool_results:
            print("model didn't call the tool; skipping round 2", file=sys.stderr)
            return 0

        second = client.messages.create(
            model=MODEL,
            max_tokens=200,
            system=weather_system,
            tools=tools,
            output_config={"effort": "low"},
            messages=[
                {"role": "user", "content": user_question},
                {"role": "assistant", "content": first.content},
                {"role": "user", "content": tool_results},
            ],
        )
        print(f"round 2 stop_reason={second.stop_reason}")
        for block in second.content:
            print(getattr(block, "text", block))

    # Adaptive thinking — let the model decide its own thinking depth.
    # `effort: "low"` keeps it cheap; `display: "summarized"` surfaces reasoning
    # text instead of the Opus 4.7 default of empty thinking blocks.
    with (
        tracer.start_as_current_span("anthropic-factor-large-int") as span,
        cassette("factor-large-int"),
    ):
        print(f"trace_id={span.get_span_context().trace_id:032x}", file=sys.stderr)
        factor = client.messages.create(
            model=MODEL,
            max_tokens=8000,
            system=math_system,
            thinking={"type": "adaptive", "display": "summarized"},
            output_config={"effort": "low"},
            messages=[
                {
                    "role": "user",
                    "content": ("Factor 123456789 into its prime factors. Show the factorization."),
                }
            ],
        )
        print(f"factor stop_reason={factor.stop_reason}")
        for block in factor.content:
            print(getattr(block, "text", block))

    # Server-side web_search tool — Anthropic runs the search; the model emits
    # `server_tool_use` blocks (not client-side `tool_use`), no roundtrip needed.
    with tracer.start_as_current_span("anthropic-web-search") as span, cassette("web-search"):
        print(f"trace_id={span.get_span_context().trace_id:032x}", file=sys.stderr)
        search = client.messages.create(
            model=MODEL,
            max_tokens=1000,
            system=research_system,
            output_config={"effort": "low"},
            tools=[{"type": "web_search_20260209", "name": "web_search"}],
            messages=[
                {
                    "role": "user",
                    "content": "What is the latest version of the anthropic Python SDK on PyPI?",
                }
            ],
        )
        print(f"search stop_reason={search.stop_reason}")
        for block in search.content:
            print(getattr(block, "text", block))

    # Multimodal vision — fetch a real image ourselves and send as base64 in
    # gen_ai.input.messages. Exercises the BlobPart -> structured-contents +
    # data-URL flatten path with realistic content. Anthropic's URL-fetcher
    # gets blocked by some hosts (including this Wikimedia URL), so we fetch
    # client-side. The fetch is also intercepted by VCR and lands in the same
    # cassette, so replays are fully offline.
    ant_image_url = (
        "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/"
        "Camponotus_flavomarginatus_ant.jpg/330px-Camponotus_flavomarginatus_ant.jpg"
    )
    with tracer.start_as_current_span("anthropic-vision") as span, cassette("vision"):
        print(f"trace_id={span.get_span_context().trace_id:032x}", file=sys.stderr)
        # Wikimedia's UA policy 403s the default Python-urllib UA — identify ourselves.
        ant_req = urllib.request.Request(
            ant_image_url,
            headers={
                "User-Agent": ("phoenix-otel-test/1.0 (+https://github.com/Arize-ai/phoenix)")
            },
        )
        with urllib.request.urlopen(ant_req) as resp:  # noqa: S310
            ant_image_b64 = base64.b64encode(resp.read()).decode("ascii")
        vision = client.messages.create(
            model=MODEL,
            max_tokens=200,
            system=vision_system,
            output_config={"effort": "low"},
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": "image/jpeg",
                                "data": ant_image_b64,
                            },
                        },
                        {"type": "text", "text": "What's in this image?"},
                    ],
                }
            ],
        )
        print(f"vision stop_reason={vision.stop_reason}")
        for block in vision.content:
            print(getattr(block, "text", block))

    # Streaming — exercises whether the Anthropic instrumentor emits the same
    # gen_ai.* span attributes for streamed responses as for non-streamed ones.
    with tracer.start_as_current_span("anthropic-streaming") as span, cassette("streaming"):
        print(f"trace_id={span.get_span_context().trace_id:032x}", file=sys.stderr)
        with client.messages.stream(
            model=MODEL,
            max_tokens=200,
            system=poet_system,
            output_config={"effort": "low"},
            messages=[{"role": "user", "content": "Write a haiku about the moon."}],
        ) as stream:
            for chunk in stream.text_stream:
                print(chunk, end="", flush=True)
            print()
            final = stream.get_final_message()
            print(f"streaming stop_reason={final.stop_reason}")

    provider.force_flush()
    provider.shutdown()
    print("\nView traces: http://localhost:6006", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

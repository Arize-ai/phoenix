# /// script
# requires-python = ">=3.10"
# dependencies = [
#     "openai",
#     "opentelemetry-sdk",
#     "opentelemetry-exporter-otlp-proto-http",
#     "opentelemetry-instrumentation-openai-v2",
#     "vcrpy==8.1.1",
# ]
# ///
"""Send OpenAI API traces to a local Phoenix at http://localhost:6006/v1/traces.

Run via:

    OPENAI_API_KEY=sk-... uv run --script \\
        scripts/testing/otel_gen_ai/send_openai_traces.py

Uses ``opentelemetry-instrumentation-openai-v2`` (the OTel python-contrib
instrumentation). With the env vars set below it follows the v1.41+ OTel GenAI
semconv (``gen_ai.input.messages`` / ``gen_ai.output.messages`` JSON arrays), the
same schema our converter consumes — so spans should land directly in our happy
path with no shape translation.

Network payloads recorded via VCR into ``cassettes/openai-<span-name>.yaml``.
Auth headers and ``OpenAI-*-Id`` response headers are scrubbed. See
``send_anthropic_traces.py`` for cassette mode notes.

Override the endpoint with ``PHOENIX_ENDPOINT`` if your Phoenix isn't on :6006.
Override the model with ``OPENAI_MODEL`` (default ``gpt-5.5``) and the
reasoning model with ``OPENAI_REASONING_MODEL`` (default ``o4-mini``).
"""

from __future__ import annotations

import os

# The opentelemetry-instrumentation-openai-v2 package emits ``gen_ai.input.messages``,
# ``gen_ai.output.messages``, etc. as JSON-array span attributes only when BOTH of
# these are set. Defaults are off — without them spans get created but carry only
# metadata (model, token counts), no actual messages. Source:
# opentelemetry/instrumentation/openai_v2/__init__.py docstring (Configuration).
os.environ.setdefault("OTEL_SEMCONV_STABILITY_OPT_IN", "gen_ai_latest_experimental")
os.environ.setdefault("OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT", "SPAN_ONLY")

import base64
import json
import sys
import urllib.request
from pathlib import Path
from urllib.parse import urlparse

import vcr
from openai import OpenAI
from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.openai_v2 import OpenAIInstrumentor
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import (
    BatchSpanProcessor,
    ConsoleSpanExporter,
    SimpleSpanProcessor,
)
from vcr.record_mode import RecordMode

PHOENIX_ENDPOINT = os.environ.get("PHOENIX_ENDPOINT", "http://localhost:6006/v1/traces")
MODEL = os.environ.get("OPENAI_MODEL", "gpt-5.5")
CASSETTE_DIR = Path(__file__).resolve().parent / "cassettes"

# Don't record OTLP traffic to Phoenix — only OpenAI API calls.
_phoenix_host = urlparse(PHOENIX_ENDPOINT).hostname or "localhost"
recorder = vcr.VCR(
    cassette_library_dir=str(CASSETTE_DIR),
    record_mode=RecordMode.ALL,
    decode_compressed_response=True,
    filter_headers=[
        ("authorization", "REDACTED"),
        ("openai-organization", "REDACTED"),
        ("openai-project", "REDACTED"),
        ("cookie", "REDACTED"),
        ("set-cookie", "REDACTED"),
        ("cf-ray", "REDACTED"),
        ("x-request-id", "REDACTED"),
    ],
    ignore_hosts=[_phoenix_host],
)


def cassette(name: str):
    """Per-span cassette under cassettes/openai-<name>.yaml."""
    return recorder.use_cassette(f"openai-{name}.yaml")


def main() -> int:
    if not os.environ.get("OPENAI_API_KEY"):
        print("Set OPENAI_API_KEY before running.", file=sys.stderr)
        return 1

    provider = TracerProvider(resource=Resource.create({"service.name": "openai-otel-demo"}))
    provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter(endpoint=PHOENIX_ENDPOINT)))
    # Diagnostic: print every finished span to stderr so we can confirm the
    # instrumentor is producing them even if the OTLP push to Phoenix fails.
    provider.add_span_processor(SimpleSpanProcessor(ConsoleSpanExporter()))
    trace.set_tracer_provider(provider)
    OpenAIInstrumentor().instrument()

    client = OpenAI()
    tracer = trace.get_tracer("openai-otel-demo")

    geography_system = "You are a terse geography expert. Answer in one word."
    weather_system = (
        "You are a helpful weather assistant. When the user asks about weather, "
        "call the get_weather tool, then summarize the result in one short sentence."
    )
    math_system = (
        "You are a meticulous number theorist. Verify each prime factor by "
        "multiplication before reporting the factorization."
    )
    vision_system = "You are a concise nature observer. Identify the subject in one sentence."
    poet_system = "You are a haiku poet. Reply with exactly one haiku (3 lines)."

    # Plain chat
    with tracer.start_as_current_span("openai-plain-chat") as span, cassette("plain-chat"):
        print(f"trace_id={span.get_span_context().trace_id:032x}", file=sys.stderr)
        response = client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": geography_system},
                {"role": "user", "content": "What's the capital of France?"},
            ],
        )
        print(response.choices[0].message.content)

    # Tool-use roundtrip — two API rounds, like Anthropic.
    tools = [
        {
            "type": "function",
            "function": {
                "name": "get_weather",
                "description": "Get the current weather in a given city.",
                "parameters": {
                    "type": "object",
                    "properties": {"city": {"type": "string"}},
                    "required": ["city"],
                },
            },
        }
    ]
    with tracer.start_as_current_span("openai-tool-use") as span, cassette("tool-use"):
        print(f"trace_id={span.get_span_context().trace_id:032x}", file=sys.stderr)
        user_question = "What's the weather in San Francisco?"
        first = client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": weather_system},
                {"role": "user", "content": user_question},
            ],
            tools=tools,
        )
        first_msg = first.choices[0].message
        print(f"round 1 finish_reason={first.choices[0].finish_reason}")
        print(first_msg)

        if not first_msg.tool_calls:
            print("model didn't call the tool; skipping round 2", file=sys.stderr)
            return 0

        # Mock execution; one tool message per tool_call.
        tool_messages = [
            {
                "role": "tool",
                "tool_call_id": tc.id,
                "content": "It's 65F and foggy in San Francisco.",
            }
            for tc in first_msg.tool_calls
        ]
        second = client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": weather_system},
                {"role": "user", "content": user_question},
                first_msg.model_dump(exclude_none=True),
                *tool_messages,
            ],
            tools=tools,
        )
        print(f"round 2 finish_reason={second.choices[0].finish_reason}")
        print(second.choices[0].message.content)

    # Reasoning model — analogous to Anthropic's adaptive thinking + Gemini's
    # ThinkingConfig. OpenAI's o-series accepts ``reasoning_effort`` directly.
    with (
        tracer.start_as_current_span("openai-factor-large-int") as span,
        cassette("factor-large-int"),
    ):
        print(f"trace_id={span.get_span_context().trace_id:032x}", file=sys.stderr)
        factor = client.chat.completions.create(
            model=MODEL,
            reasoning_effort="low",
            messages=[
                {"role": "system", "content": math_system},
                {
                    "role": "user",
                    "content": "Factor 123456789 into its prime factors. Show the factorization.",
                },
            ],
        )
        print(f"factor finish_reason={factor.choices[0].finish_reason}")
        print(factor.choices[0].message.content)

    # Multimodal vision — fetch + base64, same Wikimedia thumbnail as the
    # Anthropic / Gemini scripts. OpenAI accepts images as data URLs in
    # ``image_url`` content parts.
    ant_image_url = (
        "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/"
        "Camponotus_flavomarginatus_ant.jpg/330px-Camponotus_flavomarginatus_ant.jpg"
    )
    with tracer.start_as_current_span("openai-vision") as span, cassette("vision"):
        print(f"trace_id={span.get_span_context().trace_id:032x}", file=sys.stderr)
        ant_req = urllib.request.Request(
            ant_image_url,
            headers={"User-Agent": "phoenix-otel-test/1.0 (+https://github.com/Arize-ai/phoenix)"},
        )
        with urllib.request.urlopen(ant_req) as resp:  # noqa: S310
            ant_b64 = base64.b64encode(resp.read()).decode("ascii")
        vision = client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": vision_system},
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": "What's in this image?"},
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:image/jpeg;base64,{ant_b64}"},
                        },
                    ],
                },
            ],
        )
        print(f"vision finish_reason={vision.choices[0].finish_reason}")
        print(vision.choices[0].message.content)

    # Streaming — exercises whether the openai-v2 instrumentor emits the same
    # gen_ai.* span attributes for streamed responses as for non-streamed ones.
    with tracer.start_as_current_span("openai-streaming") as span, cassette("streaming"):
        print(f"trace_id={span.get_span_context().trace_id:032x}", file=sys.stderr)
        stream = client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": poet_system},
                {"role": "user", "content": "Write a haiku about the moon."},
            ],
            stream=True,
            stream_options={"include_usage": True},
        )
        finish_reason = None
        for chunk in stream:
            if not chunk.choices:
                continue
            choice = chunk.choices[0]
            if choice.delta and choice.delta.content:
                print(choice.delta.content, end="", flush=True)
            if choice.finish_reason:
                finish_reason = choice.finish_reason
        print()
        print(f"streaming finish_reason={finish_reason}")

    provider.force_flush()
    provider.shutdown()
    print("\nView traces: http://localhost:6006", file=sys.stderr)
    return 0


# Silences the json-import unused warning when reasoning isn't reached.
_ = json
if __name__ == "__main__":
    raise SystemExit(main())

# /// script
# requires-python = ">=3.10"
# dependencies = [
#     "google-genai",
#     "opentelemetry-sdk",
#     "opentelemetry-exporter-otlp-proto-http",
#     "opentelemetry-instrumentation-google-genai",
#     "vcrpy==8.1.1",
# ]
# ///
"""Send Google GenAI (Gemini) API traces to a local Phoenix at http://localhost:6006/v1/traces.

Two auth modes — the same SDK code works for both, only ``Client(...)`` init differs.

A) Gemini Developer API (free tier, simplest):

    GOOGLE_API_KEY=AI... uv run --script \\
        scripts/testing/otel_gen_ai/send_google_traces.py

B) Vertex AI (uses Google Cloud auth + project/location):

    # one-time auth setup
    gcloud auth application-default login
    # or: export GOOGLE_APPLICATION_CREDENTIALS=/path/to/sa.json

    GOOGLE_GENAI_USE_VERTEXAI=true \\
    GOOGLE_CLOUD_PROJECT=my-project \\
    GOOGLE_CLOUD_LOCATION=us-central1 \\
        uv run --script scripts/testing/otel_gen_ai/send_google_traces.py

Uses ``opentelemetry-instrumentation-google-genai``, which targets the newer OTel
GenAI semconv (the same v1.41+ JSON-array ``gen_ai.input.messages`` /
``gen_ai.output.messages`` schema our generator consumes). This is a good
end-to-end smoke test for the converter since the wire shape matches our model
classes directly — no shape translation needed.

Network payloads recorded via VCR into ``cassettes/google-<span-name>.yaml``.
Auth headers (``x-goog-api-key``, Vertex's ``Authorization: Bearer ...``) and
``key=`` query params are scrubbed. See ``send_anthropic_traces.py`` for cassette
mode notes; same record-mode and ignore-hosts setup.

Override the endpoint with ``PHOENIX_ENDPOINT`` if your Phoenix isn't on :6006.
Override the model with ``GEMINI_MODEL`` (default ``gemini-2.5-flash``).
"""

from __future__ import annotations

import os

# The opentelemetry-instrumentation-google-genai package emits ``gen_ai.input.messages``,
# ``gen_ai.output.messages``, and ``gen_ai.system_instructions`` JSON-array span attributes
# only when BOTH of these are set. Defaults are off — without them, spans get created but
# carry only metadata (model, token counts), no actual messages. Source:
# opentelemetry/instrumentation/google_genai/generate_content.py (_maybe_log_completion_details)
# and opentelemetry/instrumentation/_semconv.py (stability mode init).
os.environ.setdefault("OTEL_SEMCONV_STABILITY_OPT_IN", "gen_ai_latest_experimental")
os.environ.setdefault("OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT", "SPAN_ONLY")

import sys
import urllib.request
from pathlib import Path
from urllib.parse import urlparse

import vcr
from google import genai
from google.genai import types
from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.google_genai import GoogleGenAiSdkInstrumentor
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import (
    BatchSpanProcessor,
    ConsoleSpanExporter,
    SimpleSpanProcessor,
)
from vcr.record_mode import RecordMode

PHOENIX_ENDPOINT = os.environ.get("PHOENIX_ENDPOINT", "http://localhost:6006/v1/traces")
MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")
CASSETTE_DIR = Path(__file__).resolve().parent / "cassettes"

# Don't record OTLP traffic to Phoenix — only the Gemini API calls.
_phoenix_host = urlparse(PHOENIX_ENDPOINT).hostname or "localhost"
recorder = vcr.VCR(
    cassette_library_dir=str(CASSETTE_DIR),
    record_mode=RecordMode.ALL,
    decode_compressed_response=True,
    filter_headers=[
        ("x-goog-api-key", "REDACTED"),
        ("authorization", "REDACTED"),
        ("cookie", "REDACTED"),
        ("set-cookie", "REDACTED"),
    ],
    # Some Google client paths put the API key on the URL as ``?key=...``.
    filter_query_parameters=[("key", "REDACTED")],
    ignore_hosts=[_phoenix_host],
)


def cassette(name: str):
    """Per-span cassette under cassettes/google-<name>.yaml."""
    return recorder.use_cassette(f"google-{name}.yaml")


def _make_client() -> genai.Client:
    """Build a genai.Client for either Vertex AI or the Gemini Developer API."""
    use_vertex = os.environ.get("GOOGLE_GENAI_USE_VERTEXAI", "").lower() in ("1", "true")
    if use_vertex:
        project = os.environ.get("GOOGLE_CLOUD_PROJECT")
        location = os.environ.get("GOOGLE_CLOUD_LOCATION", "us-central1")
        if not project:
            raise SystemExit(
                "Vertex AI mode requires GOOGLE_CLOUD_PROJECT. "
                "Also run `gcloud auth application-default login` for ADC."
            )
        return genai.Client(vertexai=True, project=project, location=location)
    api_key = os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise SystemExit(
            "Set GOOGLE_API_KEY for the Gemini Developer API, or "
            "GOOGLE_GENAI_USE_VERTEXAI=1 + GOOGLE_CLOUD_PROJECT for Vertex AI."
        )
    return genai.Client(api_key=api_key)


def main() -> int:
    provider = TracerProvider(resource=Resource.create({"service.name": "google-otel-demo"}))
    provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter(endpoint=PHOENIX_ENDPOINT)))
    provider.add_span_processor(SimpleSpanProcessor(ConsoleSpanExporter()))
    trace.set_tracer_provider(provider)
    # skip_dep_check: the instrumentor declares google-genai>=1.0.0,<2 but the
    # SDK's Models.generate_content surface is unchanged in 2.x. Bypass the check
    # so the wrap actually applies; downgrade google-genai if any 2.x-only field
    # in the request payload trips the wrapper at runtime.
    GoogleGenAiSdkInstrumentor().instrument(skip_dep_check=True)

    client = _make_client()
    tracer = trace.get_tracer("google-otel-demo")

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
    with tracer.start_as_current_span("google-plain-chat") as span, cassette("plain-chat"):
        print(f"trace_id={span.get_span_context().trace_id:032x}", file=sys.stderr)
        response = client.models.generate_content(
            model=MODEL,
            config=types.GenerateContentConfig(system_instruction=geography_system),
            contents="What's the capital of France?",
        )
        print(response.text)

    # Tool use — google-genai's automatic function calling handles the loop for us:
    # SDK invokes the Python function on tool_call and feeds the result back, so a
    # single API call covers what's two rounds with Anthropic.
    def get_weather(city: str) -> str:
        """Get the current weather for a city."""
        return f"It's 65F and foggy in {city}."

    with tracer.start_as_current_span("google-tool-use") as span, cassette("tool-use"):
        print(f"trace_id={span.get_span_context().trace_id:032x}", file=sys.stderr)
        response = client.models.generate_content(
            model=MODEL,
            config=types.GenerateContentConfig(
                system_instruction=weather_system,
                tools=[get_weather],
            ),
            contents="What's the weather in San Francisco?",
        )
        print(response.text)

    # Adaptive thinking — Gemini 2.5 supports thinking via ThinkingConfig.
    # ``include_thoughts=True`` surfaces summarized reasoning blocks in the response.
    with (
        tracer.start_as_current_span("google-factor-large-int") as span,
        cassette("factor-large-int"),
    ):
        print(f"trace_id={span.get_span_context().trace_id:032x}", file=sys.stderr)
        response = client.models.generate_content(
            model=MODEL,
            config=types.GenerateContentConfig(
                system_instruction=math_system,
                thinking_config=types.ThinkingConfig(
                    thinking_budget=1024,
                    include_thoughts=True,
                ),
            ),
            contents="Factor 123456789 into its prime factors. Show the factorization.",
        )
        print(response.text)

    # Multimodal vision — fetch + base64 same way as the Anthropic script.
    ant_image_url = (
        "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/"
        "Camponotus_flavomarginatus_ant.jpg/330px-Camponotus_flavomarginatus_ant.jpg"
    )
    with tracer.start_as_current_span("google-vision") as span, cassette("vision"):
        print(f"trace_id={span.get_span_context().trace_id:032x}", file=sys.stderr)
        ant_req = urllib.request.Request(
            ant_image_url,
            headers={"User-Agent": "phoenix-otel-test/1.0 (+https://github.com/Arize-ai/phoenix)"},
        )
        with urllib.request.urlopen(ant_req) as resp:  # noqa: S310
            ant_image_bytes = resp.read()
        response = client.models.generate_content(
            model=MODEL,
            config=types.GenerateContentConfig(system_instruction=vision_system),
            contents=[
                types.Part.from_bytes(data=ant_image_bytes, mime_type="image/jpeg"),
                "What's in this image?",
            ],
        )
        print(response.text)

    # Streaming
    with tracer.start_as_current_span("google-streaming") as span, cassette("streaming"):
        print(f"trace_id={span.get_span_context().trace_id:032x}", file=sys.stderr)
        for chunk in client.models.generate_content_stream(
            model=MODEL,
            config=types.GenerateContentConfig(system_instruction=poet_system),
            contents="Write a haiku about the moon.",
        ):
            if chunk.text:
                print(chunk.text, end="", flush=True)
        print()

    provider.force_flush()
    provider.shutdown()
    print("\nView traces: http://localhost:6006", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

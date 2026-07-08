"""
Test script to reproduce axis label clipping issue #11312.

This script generates synthetic LLM traces with long model names to reproduce
the axis label clipping/overlap issues in the Metrics charts:
1. "Top models by cost" - Y-axis model names clipped
2. "Top models by tokens" - Y-axis model names clipped
3. "Cost" time series - Y-axis label overlaps tick values

Usage:
    uv run scripts/test_axis_label_clipping.py

Prerequisites:
    - Phoenix running locally at http://localhost:6006
"""

from random import choice, randint
from secrets import token_hex

from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor

# Configuration
PHOENIX_ENDPOINT = "http://localhost:6006/v1/traces"
PROJECT_NAME = "axis-label-test"
NUM_TRACES = 25

# Models with varying name lengths to test axis label rendering
# Include both short and long names to demonstrate the clipping issue
MODELS_WITH_PROVIDERS = [
    # Short names (should display fine)
    ("gpt-4", "openai"),
    ("gpt-4o", "openai"),
    ("o1-mini", "openai"),
    # Medium names
    ("gpt-4o-mini", "openai"),
    ("claude-3-opus", "anthropic"),
    ("gemini-1.5-pro", "google"),
    # Long names that cause clipping (from the issue screenshot)
    ("claude-sonnet-4-5", "anthropic"),  # 17 chars - gets clipped
    ("gpt-5.1-2025-11-13", "openai"),  # 18 chars - gets clipped
    ("claude-opus-4-20250514", "anthropic"),  # 22 chars
    ("gpt-4o-mini-2024-07-18", "openai"),  # 22 chars
    # Very long names (AWS Bedrock style)
    ("anthropic.claude-opus-4-20250514-v1:0", "aws"),  # 40 chars
    ("us.anthropic.claude-sonnet-4-20250514-v1:0", "aws"),  # 43 chars
    ("meta.llama4-maverick-17b-instruct-v1:0", "aws"),  # 40 chars
]

# Setup tracer
tracer_provider = TracerProvider(resource=Resource({"openinference.project.name": PROJECT_NAME}))
tracer_provider.add_span_processor(SimpleSpanProcessor(OTLPSpanExporter(PHOENIX_ENDPOINT)))
tracer = tracer_provider.get_tracer(__name__)


def create_llm_span(model_name: str, provider: str) -> None:
    """Create an LLM span with the given model name and random token counts."""
    with tracer.start_as_current_span(f"llm_call_{token_hex(4)}") as span:
        span.set_attribute("openinference.span.kind", "LLM")
        span.set_attribute("llm.model_name", model_name)
        span.set_attribute("llm.provider", provider)

        # Random token counts - varying scale to create interesting cost distribution
        scale = 10 ** randint(2, 5)  # 100 to 100,000
        prompt_tokens = randint(10, scale)
        completion_tokens = randint(10, scale)

        span.set_attribute("llm.token_count.prompt", prompt_tokens)
        span.set_attribute("llm.token_count.completion", completion_tokens)
        span.set_attribute("llm.token_count.total", prompt_tokens + completion_tokens)

        # Add some input/output for realism
        span.set_attribute("input.value", "What is machine learning?")
        span.set_attribute("output.value", "Machine learning is a subset of AI...")


def main() -> None:
    print(f"Generating {NUM_TRACES} traces for project '{PROJECT_NAME}'...")
    print(f"Sending to: {PHOENIX_ENDPOINT}")
    print()

    # Bias toward longer model names to demonstrate the issue
    # Weight longer names more heavily
    weighted_models = (
        MODELS_WITH_PROVIDERS[:3] * 1  # short names: 1x weight
        + MODELS_WITH_PROVIDERS[3:6] * 2  # medium names: 2x weight
        + MODELS_WITH_PROVIDERS[6:10] * 4  # long names: 4x weight
        + MODELS_WITH_PROVIDERS[10:] * 3  # very long names: 3x weight
    )

    for i in range(NUM_TRACES):
        with tracer.start_as_current_span(f"trace_{token_hex(4)}") as root_span:
            root_span.set_attribute("session.id", f"session_{randint(1, 5)}")

            # Each trace has 1-4 LLM calls
            num_llm_calls = randint(1, 4)
            for _ in range(num_llm_calls):
                model_name, provider = choice(weighted_models)
                create_llm_span(model_name, provider)

        if (i + 1) % 5 == 0:
            print(f"  Created {i + 1}/{NUM_TRACES} traces...")

    tracer_provider.force_flush()
    print()
    print("Done! Open Phoenix and navigate to:")
    print("  http://localhost:6006/projects/axis-label-test/metrics")
    print()
    print("Expected issues to observe:")
    print("  1. 'Top models by cost' - long model names clipped on left")
    print("  2. 'Top models by tokens' - long model names clipped on left")
    print("  3. 'Cost' chart - 'Cost (USD)' label may overlap tick values")


if __name__ == "__main__":
    main()

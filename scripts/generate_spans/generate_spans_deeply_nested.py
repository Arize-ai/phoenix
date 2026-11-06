from io import StringIO
from random import randint, sample
from secrets import token_hex

import numpy as np
import pandas as pd
from faker import Faker
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor

fake = Faker()

endpoint = "http://localhost:6006/v1/traces"

tracer_provider = TracerProvider(resource=Resource({"openinference.project.name": "DEEPLY_NESTED"}))
tracer_provider.add_span_processor(SimpleSpanProcessor(OTLPSpanExporter(endpoint)))
tracer = tracer_provider.get_tracer(__name__)


# Convert the tab-delimited string into a DataFrame
model_provider_data = """
claude-3-5-sonnet-latest,anthropic
gemini-pro,google
gpt-4o,openai
"""

df = pd.read_csv(StringIO(model_provider_data.strip()), names=["model_name", "provider"], dtype=str)


def random_split(total: int, n: int = 5, alpha: float = 1.0) -> list[int]:
    """
    Generate n random numbers that sum to total using Dirichlet distribution.

    Args:
        total (int): The total sum that the generated numbers should add up to
        n (int, optional): Number of random numbers to generate. Defaults to 5.
        alpha (float, optional): Concentration parameter for Dirichlet distribution.
            Higher values make the distribution more uniform. Defaults to 1.0.

    Returns:
        numpy.ndarray: Array of n integers that sum to total
    """
    # Generate proportions
    proportions = np.random.dirichlet([alpha] * n)

    # Scale and take floor
    scaled = proportions * total
    numbers = np.floor(scaled).astype(int)

    # Distribute the remainder
    remainder = total - np.sum(numbers)

    # Add 1 to the positions with largest fractional parts
    fractional_parts = scaled - numbers
    indices = np.argsort(fractional_parts)[-remainder:]
    numbers[indices] += 1

    return numbers.tolist()


def llm_span() -> None:
    """
    Generate a synthetic LLM span with random token counts and model information.

    Creates a span with the following attributes:
    - openinference.span.kind: Set to "LLM"
    - llm.token_count.prompt: Random number between 1000-10000
    - llm.token_count.completion: Random number between 1000-10000
    - llm.token_count.total: Sum of prompt and completion tokens
    - llm.token_count.prompt_details.*: Random split of prompt tokens for various details
    - llm.token_count.completion_details.*: Random split of completion tokens for various details
    - llm.provider: Random provider from the model list
    - llm.model_name: Random model name from the model list
    """
    with tracer.start_as_current_span(token_hex(6)) as span:
        span.set_attribute("openinference.span.kind", "LLM")
        upperbound = 10 ** sample(range(2, 9), k=1)[0]
        prompt, completion = randint(10, upperbound), randint(10, upperbound)
        span.set_attribute("llm.token_count.prompt", prompt)
        span.set_attribute("llm.token_count.completion", completion)
        span.set_attribute("llm.token_count.total", prompt + completion)
        for prefix, (total, subtotals) in {
            "prompt_details": (
                prompt,
                ["audio", "video", "image", "document", "cached_read", "cache_write"],
            ),
            "completion_details": (
                completion,
                ["audio", "video", "image", "document", "reasoning"],
            ),
        }.items():
            if not (keys := sample(subtotals, k=randint(0, len(subtotals)))):
                continue
            for key, value in zip(keys, random_split(total, n=len(keys) + 1)):
                span.set_attribute(f"llm.token_count.{prefix}.{key}", value)
        row = df.sample(1).iloc[0]
        span.set_attribute("llm.provider", str(row.provider))
        span.set_attribute("llm.model_name", str(row.model_name))
        span.set_attribute("output.value", fake.sentence())
        span.set_attribute("input.value", fake.sentence())


def create_nested_spans(depth: int, max_depth: int, spans_per_level: int) -> None:
    """
    Recursively create nested spans to achieve deep nesting with many spans.

    Args:
        depth: Current nesting depth
        max_depth: Maximum depth to nest
        spans_per_level: Number of child spans to create at each level
    """
    if depth >= max_depth:
        # At max depth, create LLM spans
        for _ in range(randint(1, 3)):
            llm_span()
        return

    # Create child spans at this level
    for _ in range(spans_per_level):
        with tracer.start_as_current_span(token_hex(6)) as span:
            span.set_attribute("openinference.span.kind", "CHAIN")
            span.set_attribute("depth", depth)

            # Create some LLM spans at this level
            for _ in range(randint(0, 2)):
                llm_span()

            # Recursively create nested spans
            create_nested_spans(depth + 1, max_depth, spans_per_level)


# Create a root span with deeply nested children
with tracer.start_as_current_span("deeply_nested_root") as root_span:
    root_span.set_attribute("openinference.span.kind", "CHAIN")
    root_span.set_attribute("session.id", randint(1, 10))

    # Create multiple branches of deeply nested spans
    # This will create 100s of spans:
    # 5 branches * 4 children per level * 8 levels = 5 * 4^8 = ~327k spans
    # But we'll limit it to create a reasonable number:
    # 5 branches * 3 children * 6 levels = ~3645 spans
    # For 100s of spans, we'll use: 3 branches * 3 children * 5 levels = ~729 spans
    num_branches = 3
    children_per_level = 3
    max_depth = 5

    for _ in range(num_branches):
        with tracer.start_as_current_span(token_hex(6)) as branch_span:
            branch_span.set_attribute("openinference.span.kind", "CHAIN")
            branch_span.set_attribute("branch", _)

            # Create some LLM spans at the branch level
            for _ in range(randint(1, 3)):
                llm_span()

            # Create deeply nested structure
            create_nested_spans(depth=1, max_depth=max_depth, spans_per_level=children_per_level)

tracer_provider.force_flush()

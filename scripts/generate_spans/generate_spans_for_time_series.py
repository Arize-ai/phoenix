from datetime import timezone
from io import StringIO
from random import randint, sample
from secrets import token_hex

import numpy as np
import pandas as pd
from faker import Faker
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor

fake = Faker()

endpoint = "http://localhost:6006/v1/traces"

tracer_provider = TracerProvider(resource=Resource({"openinference.project.name": "TIME_SERIES"}))
tracer_provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter(endpoint)))
tracer = tracer_provider.get_tracer(__name__)


# Convert the tab-delimited string into a DataFrame
model_provider_data = """
gpt-4.1,openai
gemini-2.5-pro,google
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


def llm_span(start_time: int, end_time: int) -> None:
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
    with tracer.start_as_current_span(
        token_hex(6), start_time=start_time, end_on_exit=False
    ) as span:
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
    span.end(end_time=end_time)


for _ in range(randint(1, 100)):
    start_time = int(fake.date_time_between("-72h", "now", tzinfo=timezone.utc).timestamp() * 1e9)
    end_time = start_time + randint(10_000_000, 10_000_000_000)
    llm_span(start_time, end_time)

tracer_provider.force_flush()

# /// script
# dependencies = [
#   "pandas",
#   "arize-phoenix-client",
#   "opentelemetry-sdk",
#   "opentelemetry-exporter-otlp",
# ]
# ///
from datetime import datetime, timedelta, timezone
from io import StringIO
from random import randint, random, sample
from secrets import token_hex
from typing import Iterator, Optional, cast

import numpy as np
import pandas as pd
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import ReadableSpan, TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.trace import StatusCode, format_span_id

from phoenix.client import Client

endpoint = "http://localhost:6006/v1/traces"

tracer_provider = TracerProvider(resource=Resource({"openinference.project.name": "TIME_SERIES"}))
tracer_provider.add_span_processor(SimpleSpanProcessor(OTLPSpanExporter(endpoint)))
tracer = tracer_provider.get_tracer(__name__)

client = Client(base_url="http://localhost:6006")

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

    # Add 1 to the positions with the largest fractional parts
    fractional_parts = scaled - numbers
    indices = np.argsort(fractional_parts)[-remainder:]
    numbers[indices] += 1

    return cast(list[int], numbers.tolist())


def llm_span(start_time: int, end_time: int) -> ReadableSpan:
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
    if random() < 0.01:
        span.set_status(StatusCode.UNSET)
    elif random() < 0.2:
        span.set_status(StatusCode.ERROR)
    else:
        span.set_status(StatusCode.OK)
    span.end(end_time=end_time)
    return span


def generate_timestamps(
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    rates: Optional[dict[str, float]] = None,
    local_tz: Optional[timezone] = None,
) -> Iterator[datetime]:
    """
    Generate random timestamps with different rates based on local time periods.

    Creates timestamps with different rates for:
    - Business hours (9 AM - 5 PM local weekdays): Higher rate
    - Evening hours (5 PM - 11 PM local weekdays): Medium rate
    - Night hours (11 PM - 9 AM local weekdays): Low rate
    - Weekend hours (local weekends): Low rate throughout

    Args:
        start_time: Start of time range in UTC. Defaults to 90 days ago.
        end_time: End of time range in UTC. Defaults to now.
        rates: Dictionary with hourly event rates:
            - "business": Events per hour during business hours (default: 20)
            - "evening": Events per hour during evening hours (default: 3)
            - "night": Events per hour during night hours (default: 0.5)
            - "weekend": Events per hour during weekends (default: 2)
        local_tz: Local timezone for determining business hours.
                  Defaults to system timezone.

    Yields:
        UTC datetime objects in chronological order.
    """
    if not start_time:
        start_time = datetime.now(timezone.utc) - timedelta(days=14)
    if not end_time:
        end_time = datetime.now(timezone.utc)
    if rates is None:
        rates = {"business": 20, "evening": 3, "night": 0.5, "weekend": 2}
    if local_tz is None:
        # Use system timezone as default
        local_tz = datetime.now().astimezone().tzinfo

    current = start_time.astimezone(local_tz).replace(minute=0, second=0, microsecond=0)

    while current < end_time:
        # Convert to local time to determine time period
        is_weekend = current.weekday() >= 5
        hour = current.hour

        if is_weekend:
            rate = rates["weekend"]
        elif 9 <= hour < 17:  # Business hours (local time)
            rate = rates["business"]
        elif 17 <= hour < 23:  # Evening hours (local time)
            rate = rates["evening"]
        else:  # Night hours (23-24 and 0-9, local time)
            rate = rates["night"]

        # Generate events for this hour
        if n := np.random.poisson(rate):
            # Generate random timestamps within this hour
            times = current.timestamp() + np.random.uniform(0, 3600, n)
            for t in sorted(times):
                yield datetime.fromtimestamp(t, timezone.utc)

        current += timedelta(hours=1)


spans = []

for t in sorted(generate_timestamps(), reverse=True):
    start_time = int(t.timestamp() * 1e9)
    end_time = start_time + randint(10_000_000, 10_000_000_000)
    with tracer.start_as_current_span(
        token_hex(6),
        start_time=start_time,
        end_on_exit=False,
    ) as root_span:
        llm_span(start_time, end_time)
        llm_span(start_time, end_time)
    root_span.end(end_time=end_time)
    spans.append(root_span)
    span_id = format_span_id(root_span.get_span_context().span_id)
    score = np.random.beta(2, 5)
    client.annotations.add_span_annotation(
        span_id=span_id,
        annotation_name="helpfulness",
        score=score,
        label="helpful" if score > 0.5 else "not helpful",
    )
    score = np.random.beta(5, 2)
    client.annotations.add_span_annotation(
        span_id=span_id,
        annotation_name="relevant",
        score=score,
        label="relevant" if score > 0.5 else "not relevant",
    )

# use pandas to summarize count group by calendar day
local_tz = datetime.now().astimezone().tzinfo
t = pd.Series([pd.to_datetime(span.start_time, unit="ns") for span in spans])

# Convert UTC to local timezone before grouping by date
t_local = t.dt.tz_localize("UTC").dt.tz_convert(local_tz)

# Set pandas to display all rows without truncation
pd.set_option("display.max_rows", None)
print(t_local.dt.date.value_counts().sort_index())

tracer_provider.force_flush()

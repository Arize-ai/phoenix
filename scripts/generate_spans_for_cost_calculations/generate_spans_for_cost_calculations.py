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

tracer_provider = TracerProvider(resource=Resource({"openinference.project.name": "COST_TEST"}))
tracer_provider.add_span_processor(SimpleSpanProcessor(OTLPSpanExporter(endpoint)))
tracer = tracer_provider.get_tracer(__name__)


# Convert the tab-delimited string into a DataFrame
model_provider_data = """
claude-2,anthropic
claude-2.1,anthropic
claude-3-5-haiku-20241022,anthropic
claude-3-5-haiku-latest,anthropic
claude-3-5-sonnet-20240620,anthropic
claude-3-5-sonnet-20241022,anthropic
claude-3-5-sonnet-latest,anthropic
claude-3-7-sonnet-20250219,anthropic
claude-3-7-sonnet-latest,anthropic
claude-3-haiku-20240307,anthropic
claude-3-opus-20240229,anthropic
claude-3-opus-latest,anthropic
claude-3-sonnet-20240229,anthropic
claude-4-opus-20250514,anthropic
claude-4-sonnet-20250514,anthropic
claude-instant-1,anthropic
claude-instant-1.2,anthropic
claude-opus-4-20250514,anthropic
claude-sonnet-4-20250514,anthropic
amazon.nova-lite-v1:0,aws
amazon.nova-micro-v1:0,aws
amazon.nova-pro-v1:0,aws
anthropic.claude-3-7-sonnet-20250219-v1:0,aws
anthropic.claude-opus-4-20250514-v1:0,aws
anthropic.claude-sonnet-4-20250514-v1:0,aws
eu.amazon.nova-lite-v1:0,aws
eu.amazon.nova-micro-v1:0,aws
eu.amazon.nova-pro-v1:0,aws
eu.anthropic.claude-opus-4-20250514-v1:0,aws
eu.anthropic.claude-sonnet-4-20250514-v1:0,aws
meta.llama3-3-70b-instruct-v1:0,aws
meta.llama4-maverick-17b-instruct-v1:0,aws
meta.llama4-scout-17b-instruct-v1:0,aws
us.amazon.nova-lite-v1:0,aws
us.amazon.nova-micro-v1:0,aws
us.amazon.nova-premier-v1:0,aws
us.amazon.nova-pro-v1:0,aws
us.anthropic.claude-3-7-sonnet-20250219-v1:0,aws
us.anthropic.claude-opus-4-20250514-v1:0,aws
us.anthropic.claude-sonnet-4-20250514-v1:0,aws
us.deepseek.r1-v1:0,aws
us.meta.llama3-3-70b-instruct-v1:0,aws
us.meta.llama4-maverick-17b-instruct-v1:0,aws
us.meta.llama4-scout-17b-instruct-v1:0,aws
command,cohere
command-nightly,cohere
rerank-english-v2.0,cohere
rerank-english-v3.0,cohere
rerank-multilingual-v2.0,cohere
rerank-multilingual-v3.0,cohere
rerank-v3.5,cohere
gemini-1.5-flash,google
gemini-1.5-flash-001,google
gemini-1.5-flash-002,google
gemini-1.5-flash-8b,google
gemini-1.5-flash-8b-exp-0827,google
gemini-1.5-flash-8b-exp-0924,google
gemini-1.5-flash-exp-0827,google
gemini-1.5-flash-latest,google
gemini-1.5-pro,google
gemini-1.5-pro-001,google
gemini-1.5-pro-002,google
gemini-1.5-pro-exp-0801,google
gemini-1.5-pro-exp-0827,google
gemini-1.5-pro-latest,google
gemini-2.0-flash,google
gemini-2.0-flash-001,google
gemini-2.0-flash-exp,google
gemini-2.0-flash-lite,google
gemini-2.0-flash-lite-preview-02-05,google
gemini-2.0-flash-preview-image-generation,google
gemini-2.0-flash-thinking-exp,google
gemini-2.0-flash-thinking-exp-01-21,google
gemini-2.0-pro-exp-02-05,google
gemini-2.5-flash-preview-04-17,google
gemini-2.5-flash-preview-05-20,google
gemini-2.5-flash-preview-tts,google
gemini-2.5-pro-exp-03-25,google
gemini-2.5-pro-preview-03-25,google
gemini-2.5-pro-preview-05-06,google
gemini-2.5-pro-preview-06-05,google
gemini-2.5-pro-preview-tts,google
gemini-exp-1114,google
gemini-exp-1206,google
gemini-gemma-2-27b-it,google
gemini-gemma-2-9b-it,google
gemini-pro,google
gemini-pro-vision,google
gemma-3-27b-it,google
learnlm-1.5-pro-experimental,google
codestral-2405,mistral
codestral-latest,mistral
codestral-mamba-latest,mistral
devstral-small-2505,mistral
magistral-medium-2506,mistral
magistral-medium-latest,mistral
magistral-small-2506,mistral
magistral-small-latest,mistral
mistral-large-2402,mistral
mistral-large-2407,mistral
mistral-large-2411,mistral
mistral-large-latest,mistral
mistral-medium,mistral
mistral-medium-2312,mistral
mistral-medium-2505,mistral
mistral-medium-latest,mistral
mistral-small,mistral
mistral-small-latest,mistral
mistral-tiny,mistral
open-codestral-mamba,mistral
open-mistral-7b,mistral
open-mistral-nemo,mistral
open-mistral-nemo-2407,mistral
open-mixtral-8x22b,mistral
open-mixtral-8x7b,mistral
pixtral-12b-2409,mistral
pixtral-large-2411,mistral
pixtral-large-latest,mistral
gpt-3.5-turbo,openai
gpt-3.5-turbo-0125,openai
gpt-3.5-turbo-0301,openai
gpt-3.5-turbo-0613,openai
gpt-3.5-turbo-1106,openai
gpt-3.5-turbo-16k,openai
gpt-3.5-turbo-16k-0613,openai
gpt-4,openai
gpt-4-0125-preview,openai
gpt-4-0314,openai
gpt-4-0613,openai
gpt-4-1106-preview,openai
gpt-4-1106-vision-preview,openai
gpt-4-32k,openai
gpt-4-32k-0314,openai
gpt-4-32k-0613,openai
gpt-4-turbo,openai
gpt-4-turbo-2024-04-09,openai
gpt-4-turbo-preview,openai
gpt-4-vision-preview,openai
gpt-4.1,openai
gpt-4.1-2025-04-14,openai
gpt-4.1-mini,openai
gpt-4.1-mini-2025-04-14,openai
gpt-4.1-nano,openai
gpt-4.1-nano-2025-04-14,openai
gpt-4.5-preview,openai
gpt-4.5-preview-2025-02-27,openai
gpt-4o,openai
gpt-4o-2024-05-13,openai
gpt-4o-2024-08-06,openai
gpt-4o-2024-11-20,openai
gpt-4o-audio-preview,openai
gpt-4o-audio-preview-2024-10-01,openai
gpt-4o-audio-preview-2024-12-17,openai
gpt-4o-audio-preview-2025-06-03,openai
gpt-4o-mini,openai
gpt-4o-mini-2024-07-18,openai
gpt-4o-mini-audio-preview,openai
gpt-4o-mini-audio-preview-2024-12-17,openai
gpt-4o-mini-realtime-preview,openai
gpt-4o-mini-realtime-preview-2024-12-17,openai
gpt-4o-mini-search-preview,openai
gpt-4o-mini-search-preview-2025-03-11,openai
gpt-4o-mini-transcribe,openai
gpt-4o-mini-tts,openai
gpt-4o-realtime-preview,openai
gpt-4o-realtime-preview-2024-10-01,openai
gpt-4o-realtime-preview-2024-12-17,openai
gpt-4o-search-preview,openai
gpt-4o-search-preview-2025-03-11,openai
gpt-4o-transcribe,openai
gpt-image-1,openai
o1,openai
o1-2024-12-17,openai
o1-mini,openai
o1-mini-2024-09-12,openai
o1-preview,openai
o1-preview-2024-09-12,openai
o1-pro,openai
o1-pro-2025-03-19,openai
o3,openai
o3-2025-04-16,openai
o3-mini,openai
o3-mini-2025-01-31,openai
o3-pro,openai
o3-pro-2025-06-10,openai
o4-mini,openai
o4-mini-2025-04-16,openai
grok-2,xai
grok-2-1212,xai
grok-2-latest,xai
grok-2-vision,xai
grok-2-vision-1212,xai
grok-2-vision-latest,xai
grok-3,xai
grok-3-beta,xai
grok-3-fast-beta,xai
grok-3-fast-latest,xai
grok-3-latest,xai
grok-3-mini,xai
grok-3-mini-beta,xai
grok-3-mini-fast,xai
grok-3-mini-fast-beta,xai
grok-3-mini-fast-latest,xai
grok-3-mini-latest,xai
grok-beta,xai
grok-vision-beta,xai
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


for _ in range(randint(1, 20)):
    with tracer.start_as_current_span(token_hex(6)) as root_span:
        root_span.set_attribute("session.id", randint(1, 5))
        for _ in range(randint(0, 4)):
            llm_span()
        for _ in range(randint(1, 3)):
            with tracer.start_as_current_span(token_hex(6)):
                for _ in range(randint(0, 4)):
                    llm_span()
                for _ in range(randint(1, 3)):
                    with tracer.start_as_current_span(token_hex(6)):
                        for _ in range(randint(0, 4)):
                            llm_span()
                        for _ in range(randint(1, 3)):
                            with tracer.start_as_current_span(token_hex(6)):
                                for _ in range(randint(0, 4)):
                                    llm_span()

tracer_provider.force_flush()

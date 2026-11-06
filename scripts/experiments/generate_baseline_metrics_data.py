import random
import time
import uuid
from collections.abc import Callable
from typing import Any

import httpx
import pandas as pd
from opentelemetry import trace as trace_api
from phoenix.client import Client
from phoenix.client.experiments import create_evaluator
from phoenix.otel import register

PHOENIX_URL = "http://localhost:6006"


random.seed(20260709)
register(auto_instrument=False)
tracer = trace_api.get_tracer("baseline-seed")
phoenix_client = Client(base_url=PHOENIX_URL)


def clamp_score(score: float) -> float:
    return max(0.0, min(1.0, score))


examples = [
    {
        "question": f"What is the concise answer to question {index + 1}?",
        "answer": f"Reference answer {index + 1}",
        "metadata": {
            "topic": f"topic_{index % 5}",
            "difficulty": ["easy", "medium", "hard"][index % 3],
        },
    }
    for index in range(25)
]

dataset_name = f"baseline-metrics-dataset-{uuid.uuid4()}"
dataset = phoenix_client.datasets.create_dataset(
    name=dataset_name,
    dataframe=pd.DataFrame(examples),
    input_keys=["question"],
    output_keys=["answer"],
    metadata_keys=["metadata"],
)


def make_task(
    *,
    latency_seconds: float,
    prompt_tokens_mean: int,
    completion_tokens_mean: int,
    error_rate: float,
) -> Callable[[dict[str, Any]], str]:
    def task(input: dict[str, Any]) -> str:
        time.sleep(max(0.0, random.gauss(latency_seconds, 0.01)))
        prompt_tokens = max(1, int(random.gauss(prompt_tokens_mean, 8)))
        completion_tokens = max(1, int(random.gauss(completion_tokens_mean, 5)))
        with tracer.start_as_current_span("seeded-llm-call") as span:
            span.set_attributes(
                {
                    "openinference.span.kind": "LLM",
                    "llm.model_name": "gpt-4o",
                    "llm.token_count.prompt": prompt_tokens,
                    "llm.token_count.completion": completion_tokens,
                }
            )
        if random.random() < error_rate:
            raise RuntimeError("Seeded experiment failure")
        return f"Generated answer for: {input['question']}"

    return task


def make_evaluator(name: str, bias: float) -> Callable[..., float]:
    @create_evaluator(name=name, kind="code")
    def evaluator(input: dict[str, Any], output: str, expected: dict[str, Any]) -> float:
        return clamp_score(random.gauss(bias, 0.08))

    return evaluator


experiment_ids: list[str] = []

for index in range(10):
    quality_bias = 0.48 + index * 0.045
    error_rate = [0.04, 0.08, 0.02, 0.18, 0.03, 0.02, 0.14, 0.02, 0.01, 0.01][index]
    experiment = phoenix_client.experiments.run_experiment(
        dataset=dataset,
        task=make_task(
            latency_seconds=0.16 - index * 0.01,
            prompt_tokens_mean=180 - index * 7,
            completion_tokens_mean=84 - index * 4,
            error_rate=error_rate,
        ),
        evaluators=[
            make_evaluator("correctness", quality_bias),
            make_evaluator("conciseness", quality_bias + 0.04),
            make_evaluator("groundedness", quality_bias - 0.03),
        ],
        experiment_name=f"iteration-{index + 1}",
        retries=0,
    )
    experiment_id = experiment.get("experiment_id") or experiment.get("id")
    if not isinstance(experiment_id, str):
        raise RuntimeError(f"Could not find experiment id in response: {experiment}")
    print(f"experiment {index + 1}: keys={list(experiment.keys())}, id={experiment_id}")
    experiment_ids.append(experiment_id)

response = httpx.post(
    f"{PHOENIX_URL}/graphql",
    json={
        "query": """
          mutation SetBaseline($id: ID!) {
            setExperimentBaseline(experimentId: $id, baseline: true) {
              experiment {
                id
                isBaseline
              }
            }
          }
        """,
        "variables": {"id": experiment_ids[1]},
    },
    timeout=30,
)
response.raise_for_status()
payload = response.json()
if payload.get("errors"):
    raise RuntimeError(payload["errors"])

print(f"dataset_name={dataset_name}")
print(f"baseline_experiment_id={experiment_ids[1]}")
print(payload)

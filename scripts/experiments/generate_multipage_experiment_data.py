import random
import time
import uuid
from typing import Any

import pandas as pd

from phoenix.client import Client
from phoenix.client.experiments import create_evaluator
from phoenix.experiments.types import ExampleInput

phoenix_client = Client()

examples = []
for i in range(300):
    examples.append(
        {
            "question": f"Question {i + 1}: What is the meaning of life?",
            "answer": f"Answer {i + 1}: The meaning of life is {42 + i}.",
            "metadata": {
                "topic": f"topic_{i % 10}",
                "difficulty": random.choice(["easy", "medium", "hard"]),
            },
        }
    )

df = pd.DataFrame(examples)

dataset_name = "multipage-experiment-dataset-" + str(uuid.uuid4())
dataset = phoenix_client.datasets.create_dataset(
    name=dataset_name,
    dataframe=df,
    input_keys=["question"],
    output_keys=["answer"],
    metadata_keys=["metadata"],
)


def dummy_task(input: ExampleInput) -> str:
    question = input["question"]
    time.sleep(random.uniform(0, 0.1))  # random latency
    return f"Dummy response to: {question}"


@create_evaluator(kind="code")
def random_score(input: dict[str, Any], output: str, expected: dict[str, Any]) -> float:
    return random.random()


@create_evaluator(kind="code")
def random_score_with_bias(input: dict[str, Any], output: str, expected: dict[str, Any]) -> float:
    if random.random() < 0.5:
        raise RuntimeError("Stochastic evaluator error occurred.")
    question_num = int(input["question"].split()[1].rstrip(":"))
    base_score = 0.5 + (question_num % 10) * 0.05  # Bias towards 0.5-1.0
    return min(1.0, base_score + random.uniform(-0.2, 0.2))


experiment = phoenix_client.experiments.run_experiment(
    dataset=dataset,
    task=dummy_task,
    experiment_name="dummy-experiment",
    evaluators=[
        random_score,
        random_score_with_bias,
    ],
)

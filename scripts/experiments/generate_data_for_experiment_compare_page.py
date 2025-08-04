from functools import partial
from typing import Any

import httpx
import pandas as pd
from openai import OpenAI

from phoenix.client import Client
from phoenix.evals.models import OpenAIModel
from phoenix.experiments.evaluators import (
    ConcisenessEvaluator,
    ContainsAnyKeyword,
    create_evaluator,
)
from phoenix.experiments.types import ExampleInput
from phoenix.otel import register

register(auto_instrument=True)

httpx_client = httpx.Client()
phoenix_client = Client()
contains_keyword = ContainsAnyKeyword(keywords=["Y Combinator", "YC"])
openai_client = OpenAI()

df = pd.DataFrame(
    [
        {
            "question": "What is Paul Graham known for?",
            "answer": "Co-founding Y Combinator and writing on startups and techology.",
            "metadata": {"topic": "tech"},
        },
        {
            "question": "What role did Paul Graham play in Y Combinator?",
            "answer": "He co-founded Y Combinator and served as its president, helping launch many successful startups.",  # noqa: E501
            "metadata": {"topic": "tech"},
        },
        {
            "question": "How has Paul Graham influenced the startup world?",
            "answer": "Through Y Combinator's accelerator program and his influential essays about technology startups.",  # noqa: E501
            "metadata": {"topic": "tech"},
        },
    ]
)
dataset_name = "experiment-compare-dataset"
dataset = phoenix_client.datasets.create_dataset(
    name=dataset_name,
    dataframe=df,
    input_keys=["question"],
    output_keys=["answer"],
    metadata_keys=["metadata"],
)


def task(input: ExampleInput, template: str) -> str:
    question = input["question"]
    message_content = template.format(question=question)
    response = openai_client.chat.completions.create(
        model="gpt-4o", messages=[{"role": "user", "content": message_content}]
    )
    return response.choices[0].message.content or ""


model = OpenAIModel(model="gpt-4o")
conciseness = ConcisenessEvaluator(model=model)


def jaccard_similarity(output: str, expected: dict[str, Any]) -> float:
    # https://en.wikipedia.org/wiki/Jaccard_index
    actual_words = set(output.lower().split(" "))
    expected_words = set(expected["answer"].lower().split(" "))
    words_in_common = actual_words.intersection(expected_words)
    all_words = actual_words.union(expected_words)
    return len(words_in_common) / len(all_words)


def jaccard_similarity2(output: str, expected: dict[str, Any]) -> float:
    # https://en.wikipedia.org/wiki/Jaccard_index
    actual_words = set(output.lower().split(" "))
    expected_words = set(expected["answer"].lower().split(" "))
    words_in_common = actual_words.intersection(expected_words)
    all_words = actual_words.union(expected_words)
    return len(words_in_common) / len(all_words)


eval_prompt_template = """
Given the QUESTION and REFERENCE_ANSWER, determine whether the ANSWER is accurate.
Output only a single word (accurate or inaccurate).

QUESTION: {question}

REFERENCE_ANSWER: {reference_answer}

ANSWER: {answer}

ACCURACY (accurate / inaccurate):
"""


@create_evaluator(kind="llm")  # need the decorator or the kind will default to "code"
def accuracy(input: dict[str, Any], output: str, expected: dict[str, Any]) -> float:
    message_content = eval_prompt_template.format(
        question=input["question"], reference_answer=expected["answer"], answer=output
    )
    response = openai_client.chat.completions.create(
        model="gpt-4o", messages=[{"role": "user", "content": message_content}]
    )
    response_message_content = (response.choices[0].message.content or "").lower().strip()
    return 1.0 if response_message_content == "accurate" else 0.0


task_prompt_template = "Answer in a few words: {question}"
experiment = phoenix_client.experiments.run_experiment(
    dataset=dataset,
    task=partial(task, template=task_prompt_template),
    experiment_name="short-answer",
    evaluators=[
        jaccard_similarity,
        jaccard_similarity2,
        # accuracy,
        # contains_keyword,
        # conciseness,
    ],
)

task_prompt_template = "Answer verbosely: {question}"
experiment = phoenix_client.experiments.run_experiment(
    dataset=dataset,
    task=partial(task, template=task_prompt_template),
    experiment_name="long-answer",
    evaluators=[
        jaccard_similarity,
        jaccard_similarity2,
        # accuracy,
        # contains_keyword,
        # conciseness,
    ],
)


response = httpx_client.post(
    "http://localhost:6006/graphql",
    json={
        "query": """
        mutation ExampleSelectionToolbarDeleteExamplesMutation(
          $input: DeleteDatasetExamplesInput!
        ) {
          deleteDatasetExamples(input: $input) {
            dataset {
              id
            }
          }
        }
        """,
        "variables": {
            "input": {
                "exampleIds": [dataset.examples[0]["id"]],
            }
        },
    },
    headers={"Content-Type": "application/json"},
)
response.raise_for_status()
dataset = phoenix_client.datasets.add_examples_to_dataset(
    dataset=dataset,
    inputs=[
        {"question": "What is the capital of France?"},
    ],
    outputs=[
        {"answer": "Paris is the capital of France."},
    ],
    metadata=[
        {"topic": "geography"},
    ],
)
task_prompt_template = (
    "You are an assisant that generates data for a dataset of incorrect answers to a question."
    " Generate an incorrect answer to the question: {question}"
)
experiment = phoenix_client.experiments.run_experiment(
    dataset=dataset,
    task=partial(task, template=task_prompt_template),
    experiment_name="incorrect-answer-and-very-very-long-experiment-name-supercalifragilisticexpialidocious",
    evaluators=[
        jaccard_similarity,
        jaccard_similarity2,
        # accuracy,
        # contains_keyword,
        # conciseness,
    ],
)

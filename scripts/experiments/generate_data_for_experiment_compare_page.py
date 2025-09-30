import uuid
from functools import partial
from typing import Any

import httpx
import pandas as pd
from openai import OpenAI

from phoenix.client import Client
from phoenix.client.experiments import create_evaluator
from phoenix.evals.models import OpenAIModel
from phoenix.experiments.evaluators import (
    ConcisenessEvaluator,
    ContainsAnyKeyword,
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
        {
            "question": (
                "In the context of modern technology startups, particularly those that have "
                "emerged in the last two decades, can you provide a comprehensive and detailed "
                "analysis of the various ways in which Paul Graham's essays, public talks, and "
                "direct involvement with Y Combinator have influenced not only the operational "
                "strategies of early-stage companies but also the broader cultural and "
                "philosophical approaches to entrepreneurship, including but not limited to "
                "topics such as funding models, founder psychology, product-market fit, and "
                "the evolution of startup ecosystems across different continents? Please "
                "include specific examples, references to notable essays, and a discussion "
                "of the long-term impact on both successful and failed startups."
            ),
            "answer": (
                "Paul Graham's influence on the startup world is vast and multifaceted, "
                "stemming from his prolific writing, public speaking, and hands-on "
                "mentorship through Y Combinator (YC). His essays, such as 'How to Start "
                "a Startup,' 'Do Things that Don't Scale,' and 'Maker's Schedule, "
                "Manager's Schedule,' have become foundational reading for aspiring "
                "entrepreneurs. Through these writings, Graham has shaped how founders "
                "think about product-market fit, emphasizing the importance of building "
                "something people want and iterating quickly based on user feedback. "
                "His advocacy for the 'ramen profitable' mindset encouraged startups to "
                "focus on sustainability and independence from early on. At YC, Graham "
                "pioneered the accelerator model, providing seed funding, mentorship, "
                "and a powerful network, which has since been replicated globally. This "
                "model democratized access to capital and advice, lowering barriers for "
                "diverse founders. Graham's focus on founder psychology—addressing "
                "topics like impostor syndrome, resilience, and the value of small, "
                "focused teams—has helped normalize the emotional challenges of "
                "entrepreneurship. Notable YC alumni, such as Airbnb, Dropbox, and "
                "Stripe, have cited Graham's guidance as instrumental in their early "
                "growth. His insistence on 'doing things that don't scale' encouraged "
                "startups to engage deeply with their first users, leading to better "
                "products and stronger communities. The long-term impact of Graham's "
                "work is evident in the proliferation of accelerators worldwide, the "
                "widespread adoption of lean startup principles, and a cultural shift "
                "toward embracing failure as a learning opportunity. Even startups "
                "that did not succeed often credit Graham's frameworks for helping "
                "them pivot or approach future ventures with greater insight. In "
                "summary, Paul Graham's contributions have fundamentally altered the "
                "landscape of technology entrepreneurship, fostering a more "
                "experimental, user-focused, and resilient startup culture."
            ),
            "metadata": {"topic": "long-text-test"},
        },
    ]
)
dataset_name = "experiment-compare-dataset" + str(uuid.uuid4())
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


@create_evaluator(kind="llm")  # need the decorator or the kind will default to "code"
def accuracy_label(input: dict[str, Any], output: str, expected: dict[str, Any]) -> str:
    message_content = eval_prompt_template.format(
        question=input["question"], reference_answer=expected["answer"], answer=output
    )
    response = openai_client.chat.completions.create(
        model="gpt-4o", messages=[{"role": "user", "content": message_content}]
    )
    response_message_content = (response.choices[0].message.content or "").lower().strip()
    return response_message_content


task_prompt_template = "Answer in a few words: {question}"
experiment = phoenix_client.experiments.run_experiment(
    dataset=dataset,
    task=partial(task, template=task_prompt_template),
    experiment_name="short-answer",
    evaluators=[
        jaccard_similarity,
        jaccard_similarity2,
        accuracy,
        accuracy_label,
        # contains_keyword,
        # conciseness,
    ],
    repetitions=1,
)

task_prompt_template = "Answer verbosely: {question}"
experiment = phoenix_client.experiments.run_experiment(
    dataset=dataset,
    task=partial(task, template=task_prompt_template),
    experiment_name="long-answer",
    evaluators=[
        jaccard_similarity,
        jaccard_similarity2,
        accuracy,
        accuracy_label,
        # contains_keyword,
        # conciseness,
    ],
    repetitions=3,
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
        accuracy,
        accuracy_label,
        # contains_keyword,
        # conciseness,
    ],
    repetitions=5,
)

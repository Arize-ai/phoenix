# Quickstart: Datasets

Phoenix helps you run experiments over your AI and LLM applications to evaluate and iteratively improve their performance. This quickstart shows you how to get up and running quickly.

## Setup

Launch phoenix in a notebook. If you already have phoenix server running, skip this step.

```python
import phoenix as px

px.launch_app()
```

## Datasets

Upload a dataset.

```python
import pandas as pd
import phoenix as px

df = pd.DataFrame(
    [
        {
            "question": "What is Paul Graham known for?",
            "answer": "Co-founding Y Combinator and writing on startups and techology.",
            "metadata": {"topic": "tech"},
        }
    ]
)
phoenix_client = px.Client()
dataset = phoenix_client.upload_dataset(
    dataframe=df,
    dataset_name="test-dataset",
    input_keys=["question"],
    output_keys=["answer"],
    metadata_keys=["metadata"],
)
```

## Tasks

Create a task to evaluate.

```python
from openai import OpenAI
from phoenix.datasets.types import Example

openai_client = OpenAI()

task_prompt_template = "Answer in a few words: {question}"


def task(example: Example) -> str:
    question = example.input["question"]
    message_content = task_prompt_template.format(question=question)
    response = openai_client.chat.completions.create(
        model="gpt-4o", messages=[{"role": "user", "content": message_content}]
    )
    return response.choices[0].message.content
```

## Evaluators

Use pre-built evaluators to grade task output with code...

```python
from phoenix.experiments.evaluators import ContainsAnyKeyword

contains_keyword = ContainsAnyKeyword(keywords=["Y Combinator", "YC"])
```

or LLMs.

```python
from phoenix.experiments.evaluators import ConcisenessEvaluator
from phoenix.evals.models import OpenAIModel

model = OpenAIModel(model="gpt-4o")
conciseness = ConcisenessEvaluator(model=model)
```

Define custom evaluators with code...

```python
from typing import Any, Dict


def jaccard_similarity(output: str, expected: Dict[str, Any]) -> float:
    # https://en.wikipedia.org/wiki/Jaccard_index
    actual_words = set(output.lower().split(" "))
    expected_words = set(expected["answer"].lower().split(" "))
    words_in_common = actual_words.intersection(expected_words)
    all_words = actual_words.union(expected_words)
    return len(words_in_common) / len(all_words)
```

or LLMs.

```python
from phoenix.experiments.evaluators import create_evaluator

eval_prompt_template = """
Given the QUESTION and REFERENCE_ANSWER, determine whether the ANSWER is accurate.
Output only a single word (accurate or inaccurate).

QUESTION: {question}

REFERENCE_ANSWER: {reference_answer}

ANSWER: {answer}

ACCURACY (accurate / inaccurate):
"""


@create_evaluator(kind="llm")  # need the decorator or the kind will default to "code"
def accuracy(input: Dict[str, Any], output: str, expected: Dict[str, Any]) -> float:
    message_content = eval_prompt_template.format(
        question=input["question"], reference_answer=expected["answer"], answer=output
    )
    response = openai_client.chat.completions.create(
        model="gpt-4o", messages=[{"role": "user", "content": message_content}]
    )
    response_message_content = response.choices[0].message.content.lower().strip()
    return 1.0 if response_message_content == "accurate" else 0.0
```

## Experiments

Run an experiment and evaluate the results.

```python
from phoenix.experiments import run_experiment

experiment = run_experiment(
    dataset,
    task,
    experiment_name="initial-experiment",
    evaluators=[jaccard_similarity, accuracy],
)
```

Run more evaluators after the fact.

```python
from phoenix.experiments import evaluate_experiment

experiment = evaluate_experiment(experiment, evaluators=[contains_keyword, conciseness])
```

And iterate 🚀

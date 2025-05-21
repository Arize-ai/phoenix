# Quickstart: Datasets & Experiments

[![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/arize-ai/phoenix/blob/main/tutorials/experiments/datasets_and_experiments_quickstart.ipynb)

Phoenix helps you run experiments over your AI and LLM applications to evaluate and iteratively improve their performance. This quickstart shows you how to get up and running quickly.

{% embed url="https://www.youtube.com/watch?v=2oBHX4-9Sro" %}
Background + demo on datasets
{% endembed %}

## Launch Phoenix

### Using Phoenix Cloud

1. Sign up for an Arize Phoenix account at [https://app.phoenix.arize.com/login](https://app.phoenix.arize.com/login)
2. Grab your API key from the Keys option on the left bar.
3. In your code, set your endpoint and API key:

{% tabs %}
{% tab title="Python" %}

```python
import os

PHOENIX_API_KEY = "ADD YOUR API KEY"
os.environ["PHOENIX_CLIENT_HEADERS"] = f"api_key={PHOENIX_API_KEY}"
os.environ["PHOENIX_COLLECTOR_ENDPOINT"] = "https://app.phoenix.arize.com"
```

{% endtab %}

{% tab title="Typescript" %}

```typescript
const PHOENIX_API_KEY = "ADD YOUR API KEY";
process.env["PHOENIX_CLIENT_HEADERS"] = `api_key=${PHOENIX_API_KEY}`;
process.env["PHOENIX_COLLECTOR_ENDPOINT"] = "https://app.phoenix.arize.com";
```

{% endtab %}
{% endtabs %}

### Using Self-hosted Phoenix

1. Run Phoenix using Docker, local terminal, Kubernetes etc. For more information, [see self-hosting](https://app.gitbook.com/o/-MB4weB2E-qpBe07nmSL/s/0gWR4qoGzdz04iSgPlsU/).
2. In your code, set your endpoint:

{% tabs %}
{% tab title="Python" %}

```python
import os

os.environ["PHOENIX_COLLECTOR_ENDPOINT"] = "Your Phoenix Endpoint"
```

{% endtab %}

{% tab title="Typescript" %}

```typescript
process.env["PHOENIX_COLLECTOR_ENDPOINT"] = "Your Phoenix Endpoint"
```

{% endtab %}
{% endtabs %}

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
from phoenix.experiments.types import Example

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
from typing import Any, Dict

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

### Dry Run

Sometimes we may want to do a quick sanity check on the task function or the evaluators before unleashing them on the full dataset. `run_experiment()` and `evaluate_experiment()` both are equipped with a `dry_run=` parameter for this purpose: it executes the task and evaluators on a small subset without sending data to the Phoenix server. Setting `dry_run=True` selects one sample from the dataset, and setting it to a number, e.g. `dry_run=3`, selects multiple. The sampling is also deterministic, so you can keep re-running it for debugging purposes.

---
description: >-
  The following are the key steps of running an experiment illustrated by simple
  example.
---

# Setup

Make sure you have Phoenix and the instrumentors needed for the experiment setup. For this example we will use the OpenAI instrumentor to trace the LLM calls.

```bash
pip install arize-phoenix openinference-instrumentation-openai openai
```

# Run Experiments

The key steps of running an experiment are:

1. **Define/upload a `Dataset`** (e.g. a dataframe)
   * Each record of the dataset is called an `Example`
2. **Define a task**
   * A task is a function that takes each `Example` and returns an output
3. **Define Evaluators**
   * An `Evaluator` is a function evaluates the output for each `Example`
4. **Run the experiment**

We'll start by launching the Phoenix app.

```python
import phoenix as px

px.launch_app()
```

## Load a Dataset

A dataset can be as simple as a list of strings inside a dataframe. More sophisticated datasets can be also extracted from traces based on actual production data. Here we just have a small list of questions that we want to ask an LLM about the NBA games:

#### Create pandas dataframe

```python
import pandas as pd

df = pd.DataFrame(
    {
        "question": [
            "Which team won the most games?",
            "Which team won the most games in 2015?",
            "Who led the league in 3 point shots?",
        ]
    }
)
```

The dataframe can be sent to `Phoenix` via the `Client`. `input_keys` and `output_keys` are column names of the dataframe, representing the input/output to the task in question. Here we have just questions, so we left the outputs blank:

#### Upload dataset to Phoenix

```python
import phoenix as px

dataset = px.Client().upload_dataset(
    dataframe=df,
    input_keys=["question"],
    output_keys=[],
    dataset_name="nba-questions",
)
```

Each row of the dataset is called an `Example`.

## Create a Task

A task is any function/process that returns a JSON serializable output. Task can also be an `async` function, but we used sync function here for simplicity. If the task is a function of one argument, then that argument will be bound to the `input` field of the dataset example.

```python
def task(x):
    return ...
```

For our example here, we'll ask an LLM to build SQL queries based on our question, which we'll run on a database and obtain a set of results:

#### Set Up Database

```python
import duckdb
from datasets import load_dataset

data = load_dataset("suzyanil/nba-data")["train"]
conn = duckdb.connect(database=":memory:", read_only=False)
conn.register("nba", data.to_pandas())
```

#### Set Up Prompt and LLM

```python
from textwrap import dedent

import openai

client = openai.Client()
columns = conn.query("DESCRIBE nba").to_df().to_dict(orient="records")

LLM_MODEL = "gpt-4o"

columns_str = ",".join(column["column_name"] + ": " + column["column_type"] for column in columns)
system_prompt = dedent(f"""
You are a SQL expert, and you are given a single table named nba with the following columns:
{columns_str}\n
Write a SQL query corresponding to the user's
request. Return just the query text, with no formatting (backticks, markdown, etc.).""")


def generate_query(question):
    response = client.chat.completions.create(
        model=LLM_MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": question},
        ],
    )
    return response.choices[0].message.content


def execute_query(query):
    return conn.query(query).fetchdf().to_dict(orient="records")


def text2sql(question):
    results = error = None
    try:
        results = execute_query(generate_query(question))
    except duckdb.Error as e:
        error = str(e)
    return {"query": query, "results": results, "error": error}
```

#### Define `task` as a Function

Recall that each row of the dataset is encapsulated as `Example` object. Recall that the input keys were defined when we uploaded the dataset:

```python
def task(x):
    return text2sql(x["question"])
```

#### More complex `task` inputs

More complex tasks can use additional information. These values can be accessed by defining a task function with specific parameter names which are bound to special values associated with the dataset example:

<table><thead><tr><th width="203">Parameter name</th><th width="226">Description</th><th>Example</th></tr></thead><tbody><tr><td><code>input</code></td><td>example input</td><td><code>def task(input): ...</code></td></tr><tr><td><code>expected</code></td><td>example output</td><td><code>def task(expected): ...</code></td></tr><tr><td><code>reference</code></td><td>alias for <code>expected</code></td><td><code>def task(reference): ...</code></td></tr><tr><td><code>metadata</code></td><td>example metadata</td><td><code>def task(metadata): ..</code>.</td></tr><tr><td><code>example</code></td><td><code>Example</code> object</td><td><code>def task(example): ...</code></td></tr></tbody></table>

A `task` can be defined as a sync or async function that takes any number of the above argument names in any order!

## Define Evaluators

An evaluator is any function that takes the task output and return an assessment. Here we'll simply check if the queries succeeded in obtaining any result from the database:

```python
def no_error(output) -> bool:
    return not bool(output.get("error"))


def has_results(output) -> bool:
    return bool(output.get("results"))
```

## Run an Experiment

#### Instrument OpenAI

Instrumenting the LLM will also give us the spans and traces that will be linked to the experiment, and can be examine in the Phoenix UI:

```python
from openinference.instrumentation.openai import OpenAIInstrumentor

from phoenix.otel import register

tracer_provider = register()
OpenAIInstrumentor().instrument(tracer_provider=tracer_provider)
```

#### Run the Task and Evaluators

Running an experiment is as easy as calling `run_experiment` with the components we defined above. The results of the experiment will be show up in Phoenix:

```python
from phoenix.experiments import run_experiment

run_experiment(dataset, task=task, evaluators=[no_error, has_results])
```

### Dry Run

Sometimes we may want to do a quick sanity check on the task function or the evaluators before unleashing them on the full dataset. `run_experiment()` and `evaluate_experiment()` both are equipped with a `dry_run=` parameter for this purpose: it executes the task and evaluators on a small subset without sending data to the Phoenix server. Setting `dry_run=True` selects one sample from the dataset, and setting it to a number, e.g. `dry_run=3`, selects multiple. The sampling is also deterministic, so you can keep re-running it for debugging purposes.

# Experiments: Datasets in Python

Creating and managing evaluation datasets.

## Creating Datasets

```python
from phoenix.client import Client

client = Client()

# From examples
dataset = client.datasets.create_dataset(
    name="qa-test-v1",
    examples=[
        {
            "input": {"question": "What is 2+2?"},
            "output": {"answer": "4"},
            "metadata": {"category": "math"},
        },
    ],
)

# From DataFrame
dataset = client.datasets.create_dataset(
    dataframe=df,
    name="qa-test-v1",
    input_keys=["question"],
    output_keys=["answer"],
    metadata_keys=["category"],
)
```

## From Production Traces

```python
spans_df = client.spans.get_spans_dataframe(project_identifier="my-app")

dataset = client.datasets.create_dataset(
    dataframe=spans_df[["input.value", "output.value"]],
    name="production-sample-v1",
    input_keys=["input.value"],
    output_keys=["output.value"],
)
```

## Retrieving Datasets

```python
dataset = client.datasets.get_dataset(name="qa-test-v1")
df = dataset.to_dataframe()
```

## Key Parameters

| Parameter | Description |
| --------- | ----------- |
| `input_keys` | Columns for task input |
| `output_keys` | Columns for expected output |
| `metadata_keys` | Additional context |

## Using Evaluators in Experiments

### Evaluators as experiment evaluators

Pass phoenix-evals evaluators directly to `run_experiment` as the `evaluators` argument:

```python
from functools import partial
from phoenix.client import AsyncClient
from phoenix.evals import ClassificationEvaluator, LLM, bind_evaluator

# Define an LLM evaluator
refusal = ClassificationEvaluator(
    name="refusal",
    prompt_template="Is this a refusal?\nQuestion: {{query}}\nResponse: {{response}}",
    llm=LLM(provider="openai", model="gpt-4o"),
    choices={"refusal": 0, "answer": 1},
)

# Bind to map dataset columns to evaluator params
refusal_evaluator = bind_evaluator(refusal, {"query": "input.query", "response": "output"})

# Define experiment task
async def run_rag_task(input, rag_engine):
    return rag_engine.query(input["query"])

# Run experiment with the evaluator
experiment = await AsyncClient().experiments.run_experiment(
    dataset=ds,
    task=partial(run_rag_task, rag_engine=query_engine),
    experiment_name="baseline",
    evaluators=[refusal_evaluator],
    concurrency=10,
)
```

### Evaluators as the task (meta evaluation)

To validate an evaluator against human annotations, use it as the experiment task and
score with exact-match against ground truth labels. See `validation-evaluators-python.md`.

## Best Practices

- **Versioning**: Create new datasets (e.g., `qa-test-v2`), don't modify
- **Metadata**: Track source, category, difficulty
- **Balance**: Ensure diverse coverage across categories

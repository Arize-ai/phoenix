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
spans_df = client.spans.get_spans_dataframe(project_name="my-app")

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

## Best Practices

- **Versioning**: Create new datasets (e.g., `qa-test-v2`), don't modify
- **Metadata**: Track source, category, difficulty
- **Balance**: Ensure diverse coverage across categories

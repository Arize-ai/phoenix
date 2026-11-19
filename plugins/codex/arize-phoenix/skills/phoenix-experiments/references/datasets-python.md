# Datasets in Python

A dataset is a versioned list of examples. Each example has an `input` dict, a
reference `output` dict, and a `metadata` dict. With `examples=`, every example needs
both `input` and `output` keys; pass `"output": {}` when there's no reference. Experiments read the
reference output as `expected`.

## Create a dataset

```python
from phoenix.client import Client

client = Client()

dataset = client.datasets.create_dataset(
    name="recipe-faq",
    dataset_description="Cooking questions with reviewed answers",
    examples=[
        {
            "input": {"question": "Can I use oil instead of butter in brownies?"},
            "output": {"answer": "Yes. Use about three quarters as much oil as butter."},
            "metadata": {"category": "substitutions"},
        },
    ],
)
print(dataset.id, dataset.version_id, len(dataset))
```

From a dataframe or CSV file, name the columns that go into each part:

```python
dataset = client.datasets.create_dataset(
    name="recipe-faq",
    dataframe=df,                      # or csv_file_path="questions.csv"
    input_keys=["question"],
    output_keys=["answer"],
    metadata_keys=["category"],
    split_key="split",                 # optional: a column such as "train" or "test"
    example_id_key="id",               # optional: stable IDs for later updates
)
```

How writes behave:

- `create_dataset` with an existing name syncs that dataset to exactly the examples
  you pass: it updates examples that match by ID (or by content), deletes the rest,
  and records a new version only if something changed.
- `add_examples_to_dataset` adds examples without deleting any.
- Don't sync over a dataset you didn't create without asking; use a new name.

To build a labeled dataset from human annotations, see phoenix-judge-alignment.

## Build a dataset from traces

Link each example to the span it came from with `span_id_key`, so reviewers can open
the trace from the example.

```python
from phoenix.client.types.spans import SpanQuery

spans_df = client.spans.get_spans_dataframe(
    project_identifier="my-app",
    query=SpanQuery().where("parent_id is None"),
)
# The dataframe already has a context.span_id column as well as the index.
examples_df = spans_df[
    ["context.span_id", "attributes.input.value", "attributes.output.value"]
].rename(columns={"attributes.input.value": "question", "attributes.output.value": "answer"})

dataset = client.datasets.create_dataset(
    name="production-sample",
    dataframe=examples_df,
    input_keys=["question"],
    output_keys=["answer"],
    span_id_key="context.span_id",
)
```

A trace's output is what the app said, not what it should have said. Use it as a
reference only after someone reviewed it; otherwise leave `output_keys` empty and
evaluate without a reference.

## Read and update

```python
dataset = client.datasets.get_dataset(dataset="recipe-faq")
test_only = client.datasets.get_dataset(dataset="recipe-faq", splits=["test"])
pinned = client.datasets.get_dataset(dataset="recipe-faq", version_id="VERSION_ID")

for example in dataset.examples:
    print(example["id"], example["input"], example["output"])
df = dataset.to_dataframe()

client.datasets.add_examples_to_dataset(
    dataset="recipe-faq",
    examples=[{"input": {"question": "How long should bread dough rise?"}, "output": {"answer": "About an hour, until doubled."}}],
)
versions = client.datasets.get_dataset_versions(dataset="recipe-faq")
```

`dataset` accepts a name, an ID, or a `Dataset` object. Every change creates a new
version; experiments record the version they ran against.

## Splits

Splits partition one dataset, for example into `train` (examples you tune against)
and `test` (examples you report). Assign them with `split_key` when you create the
dataset, then select them with `splits=` in `get_dataset`. Pass the filtered dataset
to `run_experiment` to run on one split.

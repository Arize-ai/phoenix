# Phoenix Methods Guide

This guide contains the grail of essential Phoenix methods and how to use them for LLM evaluation and trace collection.

## Table of Contents

1. [Tracing](#trace-collection)
2. [Datasets](#datasets)
3. [Experiments](#experiments)
4. [Evaluation Methods](#evaluation-methods)
5. [Logging Results](#logging-results)
6. [Common Patterns](#common-patterns)

---

## [Tracing](https://arize.com/docs/phoenix/tracing/llm-traces-1/quickstart-tracing-python)

### [Using Phoenix OTEL](https://arize.com/docs/phoenix/tracing/how-to-tracing/setup-tracing/setup-using-phoenix-otel)

```python
import phoenix as px
from phoenix.otel import register

# Register tracer with Phoenix
tracer_provider = register(
    project_name="recipe-agent",
    batch=True,
    auto_instrument=True
)
tracer = tracer_provider.get_tracer(__name__)
```

### Creating Spans

#### [Method 1: Context Manager](https://arize.com/docs/phoenix/tracing/how-to-tracing/setup-tracing/custom-spans#creating-spans)

```python
from opentelemetry.trace import Status, StatusCode

with tracer.start_as_current_span(
    "Query_Information",
    openinference_span_kind="chain",
) as span:
    # Set span attributes
    span.set_input("user query")
    span.set_attribute("query", "user query")
    span.set_attribute("dietary_restriction", "vegan")

    # Your code here
    response = "recipe response"

    # Set output and status
    span.set_output(response)
    span.set_status(Status(StatusCode.OK))
```

#### [Method 2: Decorator](https://arize.com/docs/phoenix/tracing/how-to-tracing/setup-tracing/instrument-python)

```python
@tracer.chain
def my_function(input_text: str) -> str:
    # This entire function becomes a span
    return "output"
```

### Span Kinds

| Kind        | Use Case                            |
| ----------- | ----------------------------------- |
| `CHAIN`     | General logic operations, functions |
| `LLM`       | Making LLM calls                    |
| `TOOL`      | Tool calls                          |
| `RETRIEVER` | Document retrieval                  |
| `AGENT`     | Agent invocations                   |
| `EMBEDDING` | Generating embeddings               |

---

### [Basic Span Querying](https://arize.com/docs/phoenix/tracing/how-to-tracing/importing-and-exporting-traces/extract-data-from-spans#running-span-queries)

```python
import phoenix as px
from phoenix.trace.dsl import SpanQuery

# Get all spans
all_spans = px.Client().get_spans_dataframe()

# Query specific spans
query = SpanQuery().where("span_kind == 'CHAIN'")
chain_spans = px.Client().query_spans(query, project_name='recipe-agent')
```

### [Advanced Querying](https://arize.com/docs/phoenix/tracing/how-to-tracing/importing-and-exporting-traces/extract-data-from-spans#running-span-queries)

#### Filtering by Attributes

```python
# Filter by span kind and attributes
query = SpanQuery().where(
    "span_kind == 'CHAIN' and 'vegan' in attributes.dietary_restriction"
)

# Filter by evaluation results
query = SpanQuery().where(
    "evals['correctness'].label == 'incorrect'"
)

# Filter spans without evaluations
query = SpanQuery().where(
    "evals['correctness'].label is None"
)
```

#### Selecting Specific Attributes

```python
# Select input and output values with renamed columns
query = SpanQuery().where("span_kind == 'LLM'").select(
    input="input.value",
    output="output.value"
)

# Rename columns using keyword arguments
query = SpanQuery().select(
    user_query="input.value",
    bot_response="output.value"
)
```

## [Datasets](https://arize.com/docs/phoenix/datasets-and-experiments/quickstart-datasets)

### [Uploading Datasets](https://arize.com/docs/phoenix/datasets-and-experiments/how-to-datasets/creating-datasets)

Phoenix datasets are the foundation for running experiments. You upload your data with specific key mappings.

#### Basic Dataset Upload

```python
import phoenix as px
from phoenix.client import Client

# Set up Phoenix client
phoenix_client = Client()

# Upload dataset with key mappings
dataset = phoenix_client.datasets.create_dataset(
    dataframe=your_dataframe,  # CSV or Pandas DataFrame
    name="my_dataset",
    input_keys=["query"],  # Columns that serve as inputs
    output_keys=[],        # Columns that serve as outputs (empty for evaluation)
    metadata_keys=["ground_truth", "explanation", "category"],  # Additional metadata
)
```

#### Dataset Key Types

| Key Type        | Purpose                                          | Example                                 |
| --------------- | ------------------------------------------------ | --------------------------------------- |
| `input_keys`    | Data passed to your task function                | `["query", "context"]`                  |
| `output_keys`   | Expected outputs (usually empty for evaluations) | `[]`                                    |
| `metadata_keys` | Ground truth, explanations, categories           | `["ground_truth_label", "explanation"]` |

#### Example: Recipe Evaluation Dataset

```python
# Upload training data
train_dataset = phoenix_client.datasets.create_dataset(
    dataframe=train_df,
    name="train_set",
    input_keys=["attributes.query"],
    output_keys=[],
    metadata_keys=[
        "attributes.output.value",
        "ground_truth_label",
        "ground_truth_explanation",
        "attributes.dietary_restriction",
        "attributes.trace_num"
    ],
)

# Upload test data
test_dataset = phoenix_client.datasets.create_dataset(
    dataframe=test_df,
    name="test_set",
    input_keys=["attributes.query"],
    output_keys=[],
    metadata_keys=[
        "attributes.output.value",
        "ground_truth_label",
        "ground_truth_explanation",
        "attributes.dietary_restriction",
        "attributes.trace_num"
    ],
)
```

## Experiments

### [Running Experiments](https://arize.com/docs/phoenix/datasets-and-experiments/how-to-experiments/run-experiments)

Phoenix experiments allow you to evaluate your models systematically with custom evaluators.

#### Basic Experiment Setup

```python
from phoenix.client.experiments import run_experiment

# Create task function
def task(input, metadata):
    # Your model logic here
    return {"prediction": "result"}

# Define evaluators
def accuracy(metadata, output):
    return metadata["ground_truth"] == output["prediction"]

# Run experiment
experiment = run_experiment(
    dataset=dataset,
    task=task,
    evaluators=[accuracy],
)
```

#### Task Function Pattern

```python
def create_task_function(base_prompt: str):
    """Create a task function that uses a specific prompt."""
    def task(input, metadata):
        # Format prompt with input and metadata
        formatted_prompt = base_prompt.format(
            query=input.get("attributes.query"),
            dietary_restriction=metadata.get("attributes.dietary_restriction"),
            output=metadata.get("attributes.output.value")
        )

        # Call LLM
        completion = litellm.completion(
            model="gpt-4o",
            messages=[{"role": "user", "content": formatted_prompt}],
            response_format={"type": "json_object"},
        )

        return json.loads(completion.choices[0].message.content)

    return task

# Usage
task = create_task_function(judge_prompt)
experiment = run_experiment(dataset=test_dataset, task=task, evaluators=[...])
```

#### [Custom Evaluators](https://arize.com/docs/phoenix/datasets-and-experiments/how-to-experiments/using-evaluators)

```python
# Binary classification evaluators
def eval_tp(metadata, output):
    """True positive evaluator."""
    label = output.get("label")
    tp = (metadata["ground_truth_label"] == "PASS") & (label.lower() == "pass")
    return tp

def eval_tn(metadata, output):
    """True negative evaluator."""
    label = output.get("label")
    tn = (metadata["ground_truth_label"] == "FAIL") & (label.lower() == "fail")
    return tn

def eval_fp(metadata, output):
    """False positive evaluator."""
    label = output.get("label")
    fp = (metadata["ground_truth_label"] == "FAIL") & (label.lower() == "pass")
    return fp

def eval_fn(metadata, output):
    """False negative evaluator."""
    label = output.get("label")
    fn = (metadata["ground_truth_label"] == "PASS") & (label.lower() == "fail")
    return fn

def accuracy(metadata, output):
    """Overall accuracy evaluator."""
    label = output.get("label")
    accuracy = (metadata["ground_truth_label"].lower() == label.lower())
    return accuracy
```

#### [Getting Experiment Results via REST API](https://arize.com/docs/phoenix/sdk-api-reference/rest-api/experiments)

```python
# Get experiment ID
experiment_id = experiment.id

# Fetch results via API
base_url = "http://localhost:6006"
url = f"{base_url}/v1/experiments/{experiment_id}/json"
response = requests.get(url)
results = response.json()

# Process results
metrics_count = defaultdict(int)
for entry in results:
    for ann in entry['annotations']:
        if ann['name'] in ('eval_tp', 'eval_tn', 'eval_fp', 'eval_fn') and ann['label'] == 'True':
            metrics_count[ann['name']] += 1

# Calculate metrics
TP = metrics_count['eval_tp']
TN = metrics_count['eval_tn']
FP = metrics_count['eval_fp']
FN = metrics_count['eval_fn']

TPR = TP / (TP + FN) if (TP + FN) > 0 else 0
TNR = TN / (TN + FP) if (TN + FP) > 0 else 0
balanced_acc = (TPR + TNR) / 2
```

#### Complete Experiment Example

```python
def run_llm_evaluation(dataset, judge_prompt: str):
    """Run complete LLM evaluation experiment."""

    # Create task function
    task = create_task_function(judge_prompt)

    # Define evaluators
    evaluators = [eval_tp, eval_tn, eval_fp, eval_fn, accuracy]

    # Run experiment
    experiment = run_experiment(
        dataset=dataset,
        task=task,
        evaluators=evaluators,
    )

    # Get results
    experiment_id = experiment.id
    base_url = "http://localhost:6006"
    url = f"{base_url}/v1/experiments/{experiment_id}/json"
    response = requests.get(url)
    results = response.json()

    # Process and return metrics
    return process_experiment_results(results)

def process_experiment_results(results):
    """Process experiment results to extract metrics."""
    metrics_count = defaultdict(int)
    for entry in results:
        for ann in entry['annotations']:
            if ann['name'] in ('eval_tp', 'eval_tn', 'eval_fp', 'eval_fn') and ann['label'] == 'True':
                metrics_count[ann['name']] += 1

    TP = metrics_count['eval_tp']
    TN = metrics_count['eval_tn']
    FP = metrics_count['eval_fp']
    FN = metrics_count['eval_fn']

    TPR = TP / (TP + FN) if (TP + FN) > 0 else 0
    TNR = TN / (TN + FP) if (TN + FP) > 0 else 0
    balanced_acc = (TPR + TNR) / 2

    return {
        "tpr": TPR,
        "tnr": TNR,
        "balanced_accuracy": balanced_acc,
        "raw_results": results
    }
```

## [Evaluation Methods](https://arize.com/docs/phoenix/evaluation/how-to-evals/bring-your-own-evaluator)

### Categorical Evaluation (ClassificationEvaluator)

Use `ClassificationEvaluator` for any evaluation that classifies outputs into discrete labels (PASS/FAIL, correct/incorrect, etc.). The evaluator uses tool calling to structure LLM output — no custom output parsers needed.

```python
from phoenix.evals import LLM, ClassificationEvaluator, async_evaluate_dataframe

llm = LLM(provider="openai", model="gpt-4o")

# Define template
template = """
You are evaluating whether a recipe adheres to dietary restrictions.
Question: {query}
Dietary Restriction: {dietary_restriction}
Recipe Response: {output}

Return a label of PASS or FAIL and your explanation.
"""

# Create evaluator with label-to-score mapping
evaluator = ClassificationEvaluator(
    name="dietary_adherence",
    llm=llm,
    prompt_template=template,
    choices={"PASS": 1.0, "FAIL": 0.0},
)

# Run evaluation on a DataFrame
results = await async_evaluate_dataframe(
    dataframe=your_dataframe,
    evaluators=[evaluator],
)
```

### Numeric Scoring with ClassificationEvaluator

For numeric scoring (e.g., 1-10), use `ClassificationEvaluator` with string choices mapped to integer scores:

```python
from phoenix.evals import LLM, ClassificationEvaluator, async_evaluate_dataframe

llm = LLM(provider="openai", model="gpt-4o")

template = """
Evaluate the quality of this recipe response on a scale of 1-10.
Question: {query}
Response: {output}

Return a score from 1 to 10 and your explanation.
"""

evaluator = ClassificationEvaluator(
    name="quality_score",
    llm=llm,
    prompt_template=template,
    choices={
        "1": 1, "2": 2, "3": 3, "4": 4, "5": 5,
        "6": 6, "7": 7, "8": 8, "9": 9, "10": 10,
    },
)

results = await async_evaluate_dataframe(
    dataframe=your_dataframe,
    evaluators=[evaluator],
)
```

### Free-form Text Generation (AsyncExecutor)

Use `AsyncExecutor` **only** for non-evaluation tasks such as synthetic data generation. For evaluations, always prefer `ClassificationEvaluator` with `async_evaluate_dataframe`.

```python
from phoenix.evals import LLM
from phoenix.evals.executors import AsyncExecutor

llm = LLM(provider="openai", model="gpt-4o")

# Example: Generate rephrased queries for synthetic data (not an evaluation)
async def rephrase_query(row):
    prompt = f"Rephrase this query in a different way: {row['query']}"
    return await llm.async_generate_text(prompt)

executor = AsyncExecutor(generation_fn=rephrase_query, concurrency=10)
rephrased, _ = await executor.execute([row.to_dict() for _, row in df.iterrows()])
```

---

## Logging Results

### Logging Evaluations to Phoenix

```python
import phoenix as px
from phoenix.client import Client
from phoenix.evals.utils import to_annotation_dataframe

# Convert evaluate_dataframe results to annotation format, then log
annotations = to_annotation_dataframe(results)
px_client = Client()
px_client.spans.log_span_annotations_dataframe(
    dataframe=annotations,
    annotation_name="LLM-as-Judge Evaluation",
    annotator_kind="LLM",
)
```

---

## Common Patterns

### Complete Evaluation Pipeline

```python
import phoenix as px
from phoenix.evals import LLM, ClassificationEvaluator, async_evaluate_dataframe
from phoenix.evals.utils import to_annotation_dataframe
from phoenix.trace.dsl import SpanQuery
from phoenix.client import Client
import pandas as pd

# 1. Load traces from Phoenix
query = SpanQuery().where("span_kind == 'CHAIN'")
px_client = Client()
traces_df = px_client.spans.get_spans_dataframe(query=query, project_identifier='recipe-agent')

# 2. Define evaluation template
template = """
Evaluate this recipe response for dietary adherence.
Query: {query}
Dietary Restriction: {dietary_restriction}
Response: {output}

Return a label of PASS or FAIL and your explanation.
"""

# 3. Set up ClassificationEvaluator
llm = LLM(provider="openai", model="gpt-4o")

evaluator = ClassificationEvaluator(
    name="dietary_adherence",
    llm=llm,
    prompt_template=template,
    choices={"PASS": 1.0, "FAIL": 0.0},
)

# 4. Rename dotted column names so evaluator template variables resolve correctly
eval_df = traces_df.rename(columns={
    "attributes.query": "query",
    "attributes.dietary_restriction": "dietary_restriction",
    "attributes.output.value": "output",
})

results = await async_evaluate_dataframe(
    dataframe=eval_df,
    evaluators=[evaluator],
)

# 5. Convert to annotations and log to Phoenix
annotations = to_annotation_dataframe(results)
px_client.spans.log_span_annotations_dataframe(
    dataframe=annotations,
    annotation_name="Dietary Adherence Evaluation",
    annotator_kind="LLM",
)
```

### Data Validation

```python
def validate_traces_df(df):
    """Validate that traces dataframe has required columns."""
    required_columns = ['attributes.query', 'attributes.output.value']
    missing_columns = [col for col in required_columns if col not in df.columns]

    if missing_columns:
        print(f"Missing required columns: {missing_columns}")
        return False

    if df.empty:
        print("DataFrame is empty!")
        return False

    return True
```

---

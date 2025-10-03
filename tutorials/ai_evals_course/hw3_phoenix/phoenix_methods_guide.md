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
# Select input and output values
query = SpanQuery().where("span_kind == 'LLM'").select(
    input="input.value",
    output="output.value"
)

# Rename columns
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
from phoenix.client import Client

# Set up Phoenix client
phoenix_client = px.Client()

# Upload dataset with key mappings
dataset = phoenix_client.upload_dataset(
    dataframe=your_dataframe, #CSV or Pandas Dataframe
    dataset_name="my_dataset",
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
train_dataset = phoenix_client.upload_dataset(
    dataframe=train_df,
    dataset_name="train_set",
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
test_dataset = phoenix_client.upload_dataset(
    dataframe=test_df,
    dataset_name="test_set",
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
from phoenix.experiments import run_experiment

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
    concurrency=3  # Number of parallel workers
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
        concurrency=3
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

### Categorical Evaluation (`llm_classify`)

```python
from phoenix.evals import llm_classify, OpenAIModel

# Define template
template = """
You are evaluating whether a recipe adheres to dietary restrictions.
Question: {query}
Dietary Restriction: {dietary_restriction}
Recipe Response: {output}

Return only: PASS or FAIL
"""

# Run evaluation
results = llm_classify(
    dataframe=your_dataframe,
    template=template,
    model=OpenAIModel('gpt-4o', api_key=os.getenv("OPENAI_API_KEY")),
    rails=["PASS", "FAIL"]
)
```

### Numeric Evaluation (`llm_generate`)

```python
from phoenix.evals import llm_generate, OpenAIModel
import re

# Define template
template = """
Evaluate the quality of this recipe response on a scale of 1-10.
Question: {query}
Response: {output}

Return only: "score: X" where X is a number 1-10
"""

# Output parser function
def score_parser(output: str, row_index: int):
    pattern = r"score:\s*(\d+)"
    match = re.search(pattern, output, re.IGNORECASE)
    return {"score": int(match.group(1)) if match else None}

# Run evaluation
results = llm_generate(
    dataframe=your_dataframe,
    template=template,
    model=OpenAIModel('gpt-4o', api_key=os.getenv("OPENAI_API_KEY")),
    output_parser=score_parser,
    include_prompt=True,
    include_response=True
)
```

### Evaluation with Custom Parser

```python
def output_parser(output: str, row_index: int) -> Dict[str, Any]:
    """Parse LLM output to extract structured data."""
    label_pattern = r'"label":\s*"([^"]*)"'
    explanation_pattern = r'"explanation":\s*"([^"]*)"'

    label_match = re.search(label_pattern, output, re.IGNORECASE)
    explanation_match = re.search(explanation_pattern, output, re.IGNORECASE)

    return {
        "label": label_match.group(1) if label_match else None,
        "explanation": explanation_match.group(1) if explanation_match else None,
    }

# Use in evaluation
results = llm_generate(
    dataframe=df,
    template=your_template,
    model=OpenAIModel('gpt-4o', api_key=os.getenv("OPENAI_API_KEY")),
    output_parser=output_parser,
    include_prompt=True,
    include_response=True
)
```

---

## Logging Results

### Logging Evaluations to Phoenix

```python
# Log evaluation results
from phoenix.client import Client

px_client = Client()
px_client.spans.log_span_annotations_dataframe(
    dataframe=results,
    annotation_name="LLM-as-Judge Evaluation",
    annotator_kind="LLM",
)
```

---

## Common Patterns

### Complete Evaluation Pipeline

```python
import phoenix as px
from phoenix.evals import llm_generate, OpenAIModel
from phoenix.trace.dsl import SpanQuery
import pandas as pd
import os

# 1. Load traces from Phoenix
query = SpanQuery().where("span_kind == 'CHAIN'")
traces_df = px.Client().query_spans(query, project_name='recipe-agent')

# 2. Define evaluation template
template = """
Evaluate this recipe response for dietary adherence.
Query: {attributes.query}
Dietary Restriction: {attributes.dietary_restriction}
Response: {attributes.output.value}

Return: {"label": "PASS/FAIL", "explanation": "your reasoning"}
"""

# 3. Define output parser
def output_parser(output: str, row_index: int):
    import re
    label_pattern = r'"label":\s*"([^"]*)"'
    explanation_pattern = r'"explanation":\s*"([^"]*)"'

    label_match = re.search(label_pattern, output, re.IGNORECASE)
    explanation_match = re.search(explanation_pattern, output, re.IGNORECASE)

    return {
        "label": label_match.group(1) if label_match else None,
        "explanation": explanation_match.group(1) if explanation_match else None,
    }

# 4. Run evaluation
results = llm_generate(
    dataframe=traces_df,
    template=template,
    model=OpenAIModel('gpt-4o', api_key=os.getenv("OPENAI_API_KEY")),
    output_parser=output_parser,
    include_prompt=True,
    include_response=True
)

# 5. Merge with original data
final_results = pd.merge(results, traces_df, left_index=True, right_index=True)

# 6. Log to Phoenix
from phoenix.client import Client

px_client = Client()
px_client.spans.log_span_annotations_dataframe(
    dataframe=final_results,
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

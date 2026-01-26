# Phoenix Tracing: Export Data and Query Spans (Python)

**Comprehensive guide for querying and exporting trace data from Phoenix using Python.**

This guide teaches you how to extract spans for analysis, evaluation, and debugging.

---

## Overview

**Why export trace data?**
- Run LLM evaluations on production traces
- Debug specific issues by filtering spans
- Analyze performance metrics (latency, token usage)
- Export to external tools (pandas, notebooks, dashboards)
- Backup traces to local storage

**Export methods:**

| Method | Use Case | Output |
|--------|----------|--------|
| `get_spans_dataframe()` | Get all spans | Pandas DataFrame |
| `query_spans()` | Filter and select specific spans | Pandas DataFrame |
| Pre-defined queries | Common patterns (RAG, agents) | Pandas DataFrame |
| `get_trace_dataset()` | Backup all traces | Parquet file |

---

## Connect to Phoenix

**Python setup:**

```python
from phoenix.client import Client

# Local Phoenix
client = Client(endpoint="http://localhost:6006")

# Phoenix Cloud
import os
os.environ["PHOENIX_CLIENT_HEADERS"] = "api_key=your-api-key"
os.environ["PHOENIX_COLLECTOR_ENDPOINT"] = "https://app.phoenix.arize.com"

client = Client()
```

**Environment variables (recommended):**

```bash
# Phoenix Cloud
export PHOENIX_API_KEY="your-api-key"
export PHOENIX_COLLECTOR_ENDPOINT="https://app.phoenix.arize.com"

# Self-hosted
export PHOENIX_COLLECTOR_ENDPOINT="https://your-phoenix-instance.com"
```

---

## Get All Spans as DataFrame

**Simplest method: Download all spans from a project.**

### 3.1 Basic Usage

```python
from phoenix.client import Client

client = Client()

# Get all spans from default project
df = client.get_spans_dataframe()

# Get all spans from specific project
df = client.get_spans_dataframe(project_name="my-chatbot")
```

**Output:** Pandas DataFrame with columns:
- `span_id`: Unique span identifier
- `parent_id`: Parent span ID (null for root spans)
- `name`: Span name
- `span_kind`: Span kind (CHAIN, LLM, RETRIEVER, etc.)
- `start_time`: Span start timestamp
- `end_time`: Span end timestamp
- `attributes`: Dict of all span attributes
- `input.value`, `output.value`, etc. (if set)

---

### 3.2 Filter by Span Kind

```python
# Get all LLM spans
df = client.get_spans_dataframe("span_kind == 'LLM'")

# Get all retriever spans
df = client.get_spans_dataframe("span_kind == 'RETRIEVER'")
```

---

### 3.3 Time Range Filtering

```python
from datetime import datetime, timedelta

# Get spans from last 7 days
start_time = datetime.now() - timedelta(days=7)
df = client.get_spans_dataframe(start_time=start_time)

# Get spans from last hour
start_time = datetime.now() - timedelta(hours=1)
df = client.get_spans_dataframe(start_time=start_time)

# Get spans excluding last 24 hours
end_time = datetime.now() - timedelta(days=1)
df = client.get_spans_dataframe(end_time=end_time)

# Get spans in specific range
start_time = datetime(2024, 1, 1)
end_time = datetime(2024, 1, 31)
df = client.get_spans_dataframe(start_time=start_time, end_time=end_time)
```

---

## Span Queries (Advanced Filtering)

**Use the Query DSL for fine-grained filtering and attribute selection.**

### 4.1 Basic Query

```python
from phoenix.client import Client
from phoenix.trace.dsl import SpanQuery

client = Client()

# Filter for LLM spans and select specific attributes
query = SpanQuery().where(
    "span_kind == 'LLM'"
).select(
    "span_id",
    "llm.model_name",
    "llm.token_count.total",
)

df = client.query_spans(query)
```

**Output:** DataFrame with columns: `span_id`, `llm.model_name`, `llm.token_count.total`

---

### 4.2 Rename Columns

```python
query = SpanQuery().where(
    "span_kind == 'LLM'"
).select(
    input="input.value",
    output="output.value",
    model="llm.model_name",
    tokens="llm.token_count.total",
)

df = client.query_spans(query)
# Columns: input, output, model, tokens
```

---

### 4.3 Complex Filters

**Filter by multiple conditions:**

```python
query = SpanQuery().where(
    "span_kind == 'LLM' and llm.model_name == 'gpt-4' and llm.token_count.total > 1000"
).select(
    "span_id",
    "input.value",
    "output.value",
    "llm.token_count.total",
)

df = client.query_spans(query)
```

**Filter by substring:**

```python
query = SpanQuery().where(
    "'error' in output.value"
).select(
    "span_id",
    "input.value",
    "output.value",
)

df = client.query_spans(query)
```

**Filter by metadata:**

```python
query = SpanQuery().where(
    "metadata['experiment_id'] == 'exp_123'"
).select(
    "span_id",
    "input.value",
    "output.value",
)

df = client.query_spans(query)
```

---

### 4.4 Filter by Evaluation Results

**Find spans with specific evaluation labels:**

```python
# Get spans labeled as "incorrect" by correctness evaluation
query = SpanQuery().where(
    "evals['correctness'].label == 'incorrect'"
).select(
    "span_id",
    "input.value",
    "output.value",
)

df = client.query_spans(query)
```

**Find spans without evaluations:**

```python
query = SpanQuery().where(
    "evals['correctness'].label is None"
).select(
    "span_id",
    "input.value",
    "output.value",
)

df = client.query_spans(query)
```

---

## Querying Retrieved Documents

**Extract documents from retriever spans for RAG evaluation.**

### 5.1 Explode Documents

```python
from phoenix.trace.dsl import SpanQuery

query = SpanQuery().where(
    "span_kind == 'RETRIEVER'"
).select(
    input="input.value",
).explode(
    "retrieval.documents",
    reference="document.content",
    score="document.score",
)

df = client.query_spans(query)
```

**Output:**

| span_id | document_position | input | reference | score |
|---------|-------------------|-------|-----------|-------|
| ABC123 | 0 | "What is Phoenix?" | "Phoenix is an AI observability platform..." | 0.95 |
| ABC123 | 1 | "What is Phoenix?" | "Phoenix uses OpenTelemetry..." | 0.87 |
| DEF456 | 0 | "How to trace?" | "Tracing captures LLM calls..." | 0.92 |

**Use case:** Input for [Retrieval (RAG) Relevance evaluations](https://docs.arize.com/phoenix/evaluation/running-pre-tested-evals/retrieval-rag-relevance).

---

### 5.2 Concatenate Documents

```python
query = SpanQuery().where(
    "span_kind == 'RETRIEVER'"
).select(
    input="input.value",
).concat(
    "retrieval.documents",
    reference="document.content",
)

df = client.query_spans(query)
```

**Output:**

| span_id | input | reference |
|---------|-------|-----------|
| ABC123 | "What is Phoenix?" | "Phoenix is an AI observability platform...\n\nPhoenix uses OpenTelemetry..." |

**Default separator:** `\n\n` (double newline)

**Custom separator:**

```python
query = SpanQuery().concat(
    "retrieval.documents",
    reference="document.content",
).with_concat_separator(separator="\n************\n")
```

---

## Pre-Defined Queries (Helper Functions)

**Phoenix provides helpers for common query patterns.**

### 6.1 Tool Calls (Agent Evaluation)

```python
from phoenix.trace.dsl.helpers import get_called_tools

client = Client()

# Get all tool calls selected by LLM agents
tools_df = get_called_tools(client)
```

**Output:** DataFrame with tool names, arguments, and results.

**Use case:** Input for [Agent Function Calling Eval](https://docs.arize.com/phoenix/evaluation/running-pre-tested-evals/tool-calling-eval).

---

### 6.2 Retrieved Documents (RAG Evaluation)

```python
from phoenix.session.evaluation import get_retrieved_documents

# Get all retrieved documents with queries
retrieved_docs_df = get_retrieved_documents(client)
```

**Output:** Same as section 5.1 (exploded documents).

**Use case:** Input for [Retrieval (RAG) Relevance evaluations](https://docs.arize.com/phoenix/evaluation/running-pre-tested-evals/retrieval-rag-relevance).

---

### 6.3 Q&A on Retrieved Data

```python
from phoenix.session.evaluation import get_qa_with_reference

# Get questions, answers, and concatenated retrieved documents
qa_df = get_qa_with_reference(client)
```

**Output:**

| span_id | input | output | reference |
|---------|-------|--------|-----------|
| ABC123 | "What is Phoenix?" | "Phoenix is an AI observability platform." | "Phoenix is...\n\nPhoenix uses..." |

**Use case:** Input for [Q&A on Retrieved Data evaluations](https://docs.arize.com/phoenix/evaluation/running-pre-tested-evals/q-and-a-on-retrieved-data).

---

## Advanced Querying

### 7.1 Joining Parent and Child Spans

```python
import pandas as pd
from phoenix.trace.dsl import SpanQuery

# Query for parent spans (indexed by span_id)
query_parent = SpanQuery().where(
    "parent_id is None"
).select(
    input="input.value",
    output="output.value",
)

# Query for child spans (indexed by parent_id → renamed as span_id)
query_child = SpanQuery().where(
    "span_kind == 'RETRIEVER'"
).select(
    span_id="parent_id",  # Use parent_id as index
).concat(
    "retrieval.documents",
    reference="document.content",
)

# Execute both queries
parent_df, child_df = client.query_spans(query_parent, query_child)

# Inner join on span_id (parent) and span_id (child's parent_id)
result_df = pd.concat([parent_df, child_df], axis=1, join="inner")
```

**Output:** Combined DataFrame with parent input/output and child retrieved documents.

---

### 7.2 Filtering in UI

**Phoenix UI search bar uses the same Query DSL:**

```
span_kind == 'LLM' and llm.token_count.total > 1000
metadata['experiment_id'] == 'exp_123'
'error' in output.value
```

**Tip:** Build queries in the UI first (immediate feedback), then move to code.

---

## Project and Time Range

### 8.1 Query Specific Project

```python
# All query methods accept project_name parameter
df = client.get_spans_dataframe(project_name="my-chatbot")

query = SpanQuery().where("span_kind == 'LLM'")
df = client.query_spans(query, project_name="my-chatbot")
```

**Default:** Queries run against default project or `PHOENIX_PROJECT_NAME` environment variable.

---

### 8.2 Time Range

```python
from datetime import datetime, timedelta

start_time = datetime.now() - timedelta(days=7)
end_time = datetime.now()

df = client.query_spans(query, start_time=start_time, end_time=end_time)
```

---

## Save All Traces (Backup)

**Export all traces to a Parquet file for backup or offline analysis.**

### 9.1 Basic Save

```python
from phoenix.client import Client

client = Client()

# Save all traces from default project
trace_dataset = client.get_trace_dataset()
trace_dataset.save()
```

**Output:**
```
💾 Trace dataset saved under ID: f7733fda-6ad6-4427-a803-55ad2182b662
📂 Trace dataset path: /path/to/trace_dataset-f7733fda-6ad6-4427-a803-55ad2182b662.parquet
```

---

### 9.2 Custom Directory

```python
import os

# Specify save directory
directory = "/my_saved_traces"
os.makedirs(directory, exist_ok=True)

# Save trace dataset
trace_id = client.get_trace_dataset().save(directory=directory)
```

**Output:**
```
💾 Trace dataset saved under ID: f7733fda-6ad6-4427-a803-55ad2182b662
📂 Trace dataset path: /my_saved_traces/trace_dataset-f7733fda-6ad6-4427-a803-55ad2182b662.parquet
```

---

### 9.3 Load Saved Traces

```python
import pandas as pd

# Read Parquet file
df = pd.read_parquet("/my_saved_traces/trace_dataset-f7733fda-6ad6-4427-a803-55ad2182b662.parquet")
```

---

## Example Workflows

### 10.1 Export LLM Spans for Evaluation

```python
from phoenix.client import Client
from phoenix.trace.dsl import SpanQuery

client = Client()

# Get all LLM spans with input, output, and model
query = SpanQuery().where(
    "span_kind == 'LLM'"
).select(
    input="input.value",
    output="output.value",
    model="llm.model_name",
)

df = client.query_spans(query)

# Save to CSV for evaluation
df.to_csv("llm_spans_for_eval.csv", index=False)
```

---

### 10.2 Analyze Token Usage by Model

```python
query = SpanQuery().where(
    "span_kind == 'LLM'"
).select(
    model="llm.model_name",
    tokens="llm.token_count.total",
)

df = client.query_spans(query)

# Group by model and sum tokens
token_usage = df.groupby("model")["tokens"].sum()
print(token_usage)
```

**Output:**
```
model
gpt-4           125000
gpt-3.5-turbo    85000
claude-3         42000
```

---

### 10.3 Export RAG Data for Evaluation

```python
from phoenix.session.evaluation import get_qa_with_reference

client = Client()

# Get questions, answers, and retrieved documents
qa_df = get_qa_with_reference(client)

# Save for RAG evaluation
qa_df.to_csv("rag_eval_data.csv", index=False)
```

**Use with Phoenix evals:**
```python
from phoenix.evals import run_evals

# Run Q&A correctness evaluation
eval_results = run_evals(
    dataframe=qa_df,
    evaluators=[QACorrectnessEvaluator()],
)
```

---

### 10.4 Find Slow LLM Calls

```python
from datetime import datetime, timedelta

query = SpanQuery().where(
    "span_kind == 'LLM'"
).select(
    "span_id",
    "llm.model_name",
    "start_time",
    "end_time",
)

df = client.query_spans(query)

# Calculate latency
df["latency_ms"] = (df["end_time"] - df["start_time"]) / timedelta(milliseconds=1)

# Find slowest calls
slow_calls = df.nlargest(10, "latency_ms")
print(slow_calls)
```

---

## Exporting Spans with Annotations

**Include evaluation results (annotations) in exported data.**

```python
# Include annotations (evaluation results)
df = client.get_spans_dataframe(include_annotations=True)

# Annotations appear as additional columns:
# - eval_{eval_name}_label
# - eval_{eval_name}_score
# - eval_{eval_name}_explanation
```

**Example:**
```python
df = client.get_spans_dataframe(
    "span_kind == 'LLM'",
    include_annotations=True,
)

# Filter for incorrect spans
incorrect_spans = df[df["eval_correctness_label"] == "incorrect"]
```

---

## Best Practices

### 12.1 Use Filters to Reduce Data

**Don't:**
```python
df = client.get_spans_dataframe()  # Gets ALL spans
filtered = df[df["span_kind"] == "LLM"]  # Filters in pandas
```

**Do:**
```python
df = client.get_spans_dataframe("span_kind == 'LLM'")  # Filters at source
```

**Why:** Phoenix filters server-side, reducing network transfer and memory usage.

---

### 12.2 Use Time Ranges for Large Projects

```python
from datetime import datetime, timedelta

# Only get recent spans
start_time = datetime.now() - timedelta(days=1)
df = client.query_spans(query, start_time=start_time)
```

**Why:** Reduces query time and memory usage.

---

### 12.3 Test Queries in UI First

1. Go to Phoenix UI → Project → Search bar
2. Enter query: `span_kind == 'LLM' and llm.token_count.total > 1000`
3. Verify results
4. Copy query to code

**Why:** Immediate feedback, easier to debug complex queries.

---

## Troubleshooting

### 13.1 Empty DataFrame

**Possible causes:**
1. No spans match filter
2. Project name incorrect
3. Time range too narrow

**Debug:**
```python
# Check total span count
df_all = client.get_spans_dataframe()
print(f"Total spans: {len(df_all)}")

# Check span kinds
print(df_all["span_kind"].value_counts())

# Try without filter
df = client.get_spans_dataframe()
print(df.head())
```

---

### 13.2 Missing Columns

**Possible causes:**
1. Attribute not set on spans
2. Wrong attribute name

**Debug:**
```python
# Check available attributes
df = client.get_spans_dataframe()
print(df.columns)

# Check attributes dict
print(df["attributes"].iloc[0])
```

---

### 13.3 Authentication Errors

**Error:** `401 Unauthorized`

**Fix:**
```python
import os

# Phoenix Cloud
os.environ["PHOENIX_CLIENT_HEADERS"] = "api_key=your-api-key"
os.environ["PHOENIX_COLLECTOR_ENDPOINT"] = "https://app.phoenix.arize.com"

client = Client()
```

---

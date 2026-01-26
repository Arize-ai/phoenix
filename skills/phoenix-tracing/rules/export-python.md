# Export Trace Data (Python)

Query and export spans for evaluation, debugging, and analysis.

## Metadata

| Attribute | Value |
|-----------|-------|
| Impact | High - enables LLM evaluation pipeline |
| Use Cases | RAG assessment, token analysis, debugging, offline evaluation |
| Setup Time | <5 min |

## Quick Reference

| Method | Purpose | Example Lines |
|--------|---------|---------------|
| `get_spans_dataframe()` | Export all/filtered spans | 2 |
| `query_spans()` | Advanced filtering & column selection | 5 |
| `get_qa_with_reference()` | RAG Q&A evaluation data | 2 |
| `get_retrieved_documents()` | Retrieval evaluation data | 2 |

## Setup

```python
from phoenix.client import Client

# Local Phoenix
client = Client(endpoint="http://localhost:6006")

# Phoenix Cloud
import os
os.environ["PHOENIX_API_KEY"] = "your-api-key"
os.environ["PHOENIX_COLLECTOR_ENDPOINT"] = "https://app.phoenix.arize.com"
client = Client()
```

## Basic Export

```python
# All spans
df = client.get_spans_dataframe()

# Filter by span kind
df = client.get_spans_dataframe("span_kind == 'LLM'")

# Time range
from datetime import datetime, timedelta
df = client.get_spans_dataframe(
    start_time=datetime.now() - timedelta(days=7),
    end_time=datetime.now()
)

# Specific project
df = client.get_spans_dataframe(project_name="my-chatbot")
```

## Query DSL (Advanced Filtering)

```python
from phoenix.trace.dsl import SpanQuery

# Basic: filter and select columns
query = SpanQuery().where(
    "span_kind == 'LLM'"
).select(
    "span_id",
    "llm.model_name",
    "llm.token_count.total"
)
df = client.query_spans(query)

# Rename columns
query = SpanQuery().where(
    "span_kind == 'LLM'"
).select(
    input="input.value",
    output="output.value",
    model="llm.model_name",
    tokens="llm.token_count.total"
)
df = client.query_spans(query)

# Complex filters
query = SpanQuery().where(
    "span_kind == 'LLM' and "
    "llm.model_name == 'gpt-4' and "
    "llm.token_count.total > 1000"
)
df = client.query_spans(query)

# Substring search
query = SpanQuery().where("'error' in output.value")
df = client.query_spans(query)

# Metadata filtering
query = SpanQuery().where("metadata['experiment_id'] == 'exp_123'")
df = client.query_spans(query)

# Evaluation results
query = SpanQuery().where("evals['correctness'].label == 'incorrect'")
df = client.query_spans(query)
```

## RAG Evaluation Helpers

```python
from phoenix.session.evaluation import get_qa_with_reference, get_retrieved_documents

# Q&A with concatenated references (for Q&A correctness eval)
qa_df = get_qa_with_reference(client)

# Exploded retrieved documents (for retrieval relevance eval)
docs_df = get_retrieved_documents(client)
```

**Explode documents manually:**

```python
query = SpanQuery().where(
    "span_kind == 'RETRIEVER'"
).select(
    input="input.value"
).explode(
    "retrieval.documents",
    reference="document.content",
    score="document.score"
)
df = client.query_spans(query)
```

**Concatenate documents manually:**

```python
query = SpanQuery().where(
    "span_kind == 'RETRIEVER'"
).select(
    input="input.value"
).concat(
    "retrieval.documents",
    reference="document.content"
).with_concat_separator(separator="\n\n")
df = client.query_spans(query)
```

## Best Practices

**Bad: Load all data then filter client-side**

```python
df = client.get_spans_dataframe()
filtered = df[df["span_kind"] == "LLM"]
```

**Good: Filter server-side**

```python
df = client.get_spans_dataframe("span_kind == 'LLM'")
```

**Why:** Server-side filtering reduces network transfer (10-100× faster) and memory usage.

---

**Bad: Query without time range on large projects**

```python
df = client.get_spans_dataframe()
```

**Good: Use time ranges**

```python
from datetime import datetime, timedelta
df = client.get_spans_dataframe(
    start_time=datetime.now() - timedelta(days=1)
)
```

**Why:** Reduces query time and memory usage on projects with millions of spans.

---

**Tip:** Test queries in Phoenix UI search bar first for immediate feedback, then copy to code.

## See Also

- **Evaluation guide:** `evaluation-python.md` for running evals on exported data
- **Query DSL reference:** https://docs.arize.com/phoenix/api/query-dsl
- **Client API:** https://docs.arize.com/phoenix/api/python-client

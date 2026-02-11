# Client Setup and Fetching Spans

## Client Initialization

```python
from phoenix.client import Client

# Constructor signature
client = Client(
    base_url="https://app.phoenix.arize.com/s/your-space",  # NOT endpoint=
    api_key="your-api-key",        # Optional, for authenticated instances
    headers={"Custom": "header"},   # Optional additional headers
)
```

### Base URL vs Collector Endpoint

The OTEL collector endpoint (used for sending traces) and the Client base URL are different:

```python
# OTEL collector endpoint (for tracing):
#   https://app.phoenix.arize.com/s/your-space/v1/traces

# Client base URL (for fetching data):
#   https://app.phoenix.arize.com/s/your-space
#   (strip the /v1/traces suffix!)

import os
collector = os.environ.get("PHOENIX_COLLECTOR_ENDPOINT", "")
base_url = collector.rstrip("/")
if base_url.endswith("/v1/traces"):
    base_url = base_url[:-len("/v1/traces")]

client = Client(base_url=base_url, api_key=os.environ.get("PHOENIX_API_KEY"))
```

## Fetching Spans

```python
df = client.spans.get_spans_dataframe(
    project_identifier="my-project",  # NOT project_name= (deprecated)
    root_spans_only=True,             # Only top-level spans
    limit=50,                         # Max rows to return (default: 1000)
    start_time=datetime_obj,          # Optional: filter by time (generous!)
    end_time=datetime_obj,            # Optional: filter by time
)
```

### Important Parameters

| Parameter | Notes |
| --------- | ----- |
| `project_identifier` | Use this, NOT `project_name` (deprecated) |
| `root_spans_only` | Always `True` for evaluation — gets top-level spans with user input/output |
| `limit` | Default 1000. Set lower for faster queries |
| `start_time` | **Be generous** — `timedelta(hours=1)` often misses data. Use `timedelta(days=7)` or omit |

### DataFrame Columns

The returned DataFrame has these columns:

| Column | Description |
| ------ | ----------- |
| `context.span_id` | Unique span ID (also the DataFrame index) |
| `context.trace_id` | Trace ID grouping related spans |
| `name` | Span name (e.g., "RunnableSequence", "ChatAnthropic") |
| `span_kind` | Type: "CHAIN", "LLM", "RETRIEVER", "UNKNOWN", etc. |
| `parent_id` | Parent span ID (null for root spans) |
| `start_time` | Span start timestamp |
| `end_time` | Span end timestamp |
| `status_code` | "OK" or "ERROR" |
| `attributes.input.value` | Input text or JSON string |
| `attributes.output.value` | Output text or JSON string |
| `attributes.input.mime_type` | MIME type of input |
| `attributes.output.mime_type` | MIME type of output |
| `attributes.llm.model_name` | Model used (LLM spans) |
| `attributes.llm.token_count.total` | Total tokens (LLM spans) |
| `attributes.llm.token_count.prompt` | Prompt tokens (LLM spans) |
| `attributes.llm.token_count.completion` | Completion tokens (LLM spans) |

### Output Value is Often JSON

For LangChain/framework instrumented apps, root span output is often a JSON string,
not plain text:

```python
import json

# Root span output might be:
#   {"context": "...", "question": "...", "docs": [...], "answer": "actual answer text"}

def extract_answer(output_value):
    """Extract answer text from span output."""
    if not isinstance(output_value, str):
        return str(output_value) if output_value is not None else ""
    try:
        parsed = json.loads(output_value)
        if isinstance(parsed, dict) and "answer" in parsed:
            return parsed["answer"]
    except (json.JSONDecodeError, TypeError):
        pass
    return output_value

# Apply before passing to evaluators
df["attributes.output.value"] = df["attributes.output.value"].apply(extract_answer)
```

## SpanQuery for Advanced Filtering

```python
from phoenix.client.types.spans import SpanQuery

query = (
    SpanQuery()
    .select("span_id", "name", "attributes.llm.token_count.total")
    .where("span_kind == 'LLM'")
    .with_index("span_id")
)

df = client.spans.get_spans_dataframe(
    query=query,
    project_identifier="my-project",
    limit=100,
)
```

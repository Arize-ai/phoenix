# Observe: Tracing Setup

Configure tracing to capture data for evaluation.

## Quick Setup

```python
# Python
from phoenix.otel import register

register(project_name="my-app", auto_instrument=True)
```

```typescript
// TypeScript
import { registerPhoenix } from "@arizeai/phoenix-otel";

registerPhoenix({ projectName: "my-app", autoInstrument: true });
```

## Essential Attributes

| Attribute | Why It Matters |
| --------- | -------------- |
| `input.value` | User's request |
| `output.value` | Response to evaluate |
| `retrieval.documents` | Context for faithfulness |
| `tool.name`, `tool.parameters` | Agent evaluation |
| `llm.model_name` | Track by model |

## Custom Attributes for Evals

```python
span.set_attribute("metadata.client_type", "enterprise")
span.set_attribute("metadata.query_category", "billing")
```

## Exporting for Evaluation

### Spans (Python — DataFrame)

```python
from phoenix.client import Client
from phoenix.client.types.spans import SpanQuery

# Client() works for local Phoenix (falls back to env vars or localhost:6006)
# For remote/cloud: Client(base_url="https://app.phoenix.arize.com", api_key="...")
client = Client()
spans_df = client.spans.get_spans_dataframe(
    project_identifier="my-app",  # NOT project_name= (deprecated)
    query=SpanQuery().where("parent_id is None"),  # top-level spans only
)

dataset = client.datasets.create_dataset(
    name="error-analysis-set",
    dataframe=spans_df[["input.value", "output.value"]],
    input_keys=["input.value"],
    output_keys=["output.value"],
)
```

#### Filter expressions for `SpanQuery().where(...)`

The `where` string is a **Python boolean expression** compiled server-side, the same language as the
UI spans filter bar and the GraphQL `filterCondition`. Root spans are a clause in the query:
`parent_id is None` keeps spans with no parent id, and `parent_span is None` also keeps orphans
whose parent was never received.

The bound names are exhaustive: `span_id`, `trace_id`, `parent_id`, `name`, `span_kind`,
`status_code`, `status_message` (strings; `span_kind` / `status_code` literals are uppercased for
you), `latency_ms`, `cumulative_llm_token_count_prompt|completion|total`,
`llm.token_count.prompt|completion|total`, `total_cost`, `prompt_cost`, `completion_cost`
(numbers), `start_time`, `end_time` (compare against an ISO 8601 literal with an offset),
`cost_details` (iterable for `any`/`all`/`len`/`sum`/`max`/`min`), `parent_span` (only `is None` /
`is not None`), and the annotation accessors `annotations['name']` / `evals['name']` (on the span)
and `trace_annotations['name']` (on its trace), each with `.label`, `.score`, `.explanation`.
**Every other identifier is an attribute path** (`llm.model_name`, `input.value`, `output.value`,
`metadata['k']`, `attributes['x']`), so a typo or a trace-level name (`error_count`, `num_spans`,
bare `input`) compiles and silently matches nothing. Operators: `==` `!=` `<` `<=` `>` `>=`,
`and` / `or` / `not`, `in` / `not in` (`'text' in field` is a case-insensitive substring search),
`is None` / `is not None`, `+ - * / %`, and the casts `float()` / `int()` / `str()`; nothing else
(no `null`, `like`, `&&`, `=`, method calls). Numbers are unquoted, strings are quoted, and a
missing value fails every comparison including `!=`.

```python span-filter
parent_id is None
parent_span is None and latency_ms > 1000
parent_id is None and status_code == 'ERROR'
span_kind == 'LLM' and llm.model_name == 'gpt-4o'
span_kind == 'RETRIEVER'
'refund' in input.value
metadata['client_type'] == 'enterprise'
annotations['correctness'].label is None
parent_id is None and trace_annotations['quality'].label == 'poor'
start_time > '2026-09-01T00:00:00Z'
```

### Spans (TypeScript)

```typescript
import { getSpans } from "@arizeai/phoenix-client/spans";

const { spans } = await getSpans({
  project: { projectName: "my-app" },
  parentId: null, // root spans only
  limit: 100,
});
```

### Traces (Python — structured)

Use `get_traces` when you need full trace trees (e.g., multi-turn conversations, agent workflows):

```python
from datetime import datetime, timedelta

traces = client.traces.get_traces(
    project_identifier="my-app",
    start_time=datetime.now() - timedelta(hours=24),
    include_spans=True,  # includes all spans per trace
    limit=100,
)
# Each trace has: trace_id, start_time, end_time, spans (when include_spans=True)
```

### Traces (TypeScript)

```typescript
import { getTraces } from "@arizeai/phoenix-client/traces";

const { traces } = await getTraces({
  project: { projectName: "my-app" },
  startTime: new Date(Date.now() - 24 * 60 * 60 * 1000),
  includeSpans: true,
  limit: 100,
});
```

## Uploading Evaluations as Annotations

### Python

```python
from phoenix.evals import evaluate_dataframe
from phoenix.evals.utils import to_annotation_dataframe

# Run evaluations
results_df = evaluate_dataframe(dataframe=spans_df, evaluators=[my_eval])

# Format results for Phoenix annotations
annotations_df = to_annotation_dataframe(results_df)

# Upload to Phoenix
client.spans.log_span_annotations_dataframe(dataframe=annotations_df)
```

### TypeScript

```typescript
import { logSpanAnnotations } from "@arizeai/phoenix-client/spans";

await logSpanAnnotations({
  spanAnnotations: [
    {
      spanId: "abc123",
      name: "quality",
      label: "good",
      score: 0.95,
      annotatorKind: "LLM",
    },
  ],
});
```

Annotations are visible in the Phoenix UI alongside your traces.

## Verify

Required attributes: `input.value`, `output.value`, `status_code`
For RAG: `retrieval.documents`
For agents: `tool.name`, `tool.parameters`

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

```python
from phoenix.client import Client

client = Client()
spans_df = client.spans.get_spans_dataframe(
    project_name="my-app",
    filter_condition="status_code == 'ERROR'",
)

dataset = client.datasets.create_dataset(
    name="error-analysis-set",
    dataframe=spans_df[["input.value", "output.value"]],
    input_keys=["input.value"],
    output_keys=["output.value"],
)
```

## Verify

Required attributes: `input.value`, `output.value`, `status_code`
For RAG: `retrieval.documents`
For agents: `tool.name`, `tool.parameters`

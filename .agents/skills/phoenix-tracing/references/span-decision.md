# DECISION Spans

> **Experimental.** Phoenix recognizes the DECISION kind and renders it with its own icon, but support for decision models is still being built out. There are no decision-specific semantic attributes yet, and no decision-model provider is fully supported. Expect these conventions to change.

## Purpose

DECISION spans represent a call to a decision model: a model that scores or selects among candidate options supplied in the request rather than generating free-form text. Typical uses are routing (which agent or tool handles a request), classification (judging a condition), and rubric scoring (ranking items against criteria).

Use DECISION instead of LLM when the output is a choice over inputs, not generated prose. Use EVALUATOR when the span scores a model's output for quality; use GUARDRAIL when it enforces a safety or policy check.

## Required Attributes

| Attribute | Type | Description | Required |
|-----------|------|-------------|----------|
| `openinference.span.kind` | String | Must be "DECISION" | Yes |

## Common Attributes

| Attribute | Type | Description |
|-----------|------|-------------|
| `input.value` | String | The request, including the candidate options |
| `input.mime_type` | String | `application/json` when the input is structured |
| `output.value` | String | The selected option, label, or scores |
| `metadata.model_name` | String | Decision model identifier |
| `metadata.candidates` | String | JSON array of the options presented |
| `metadata.confidence` | Float | Confidence in the selection (0-1) |

## Example: Routing

```json
{
  "openinference.span.kind": "DECISION",
  "input.value": "{\"query\": \"Cancel my subscription\", \"candidates\": [\"billing\", \"technical_support\", \"sales\"]}",
  "input.mime_type": "application/json",
  "output.value": "billing",
  "metadata.model_name": "intent-router-v3",
  "metadata.candidates": "[\"billing\", \"technical_support\", \"sales\"]",
  "metadata.confidence": 0.91
}
```

## Example: Rubric Scoring

```json
{
  "openinference.span.kind": "DECISION",
  "input.value": "{\"item\": \"Refund issued within 24 hours.\", \"rubric\": [\"timely\", \"complete\", \"polite\"]}",
  "input.mime_type": "application/json",
  "output.value": "{\"timely\": 1.0, \"complete\": 0.8, \"polite\": 0.6}",
  "output.mime_type": "application/json",
  "metadata.model_name": "rubric-scorer"
}
```

## Instrumentation

No dedicated decorator or wrapper ships yet. Set the kind directly:

```python
with tracer.start_as_current_span(
    "route-request", openinference_span_kind="decision"
) as span:
    span.set_input(request)
    span.set_output(chosen_route)
```

```typescript
const route = withSpan(routeRequest, { kind: "DECISION" });
```

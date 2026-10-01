# DECISION Spans

> **Experimental.** Phoenix recognizes the DECISION kind and renders it with its own icon, but support for decision models is still being built out. There are no decision-specific semantic attributes yet, and no decision-model provider is fully supported. Expect these conventions to change.

## Purpose

DECISION spans represent a call to a decision model: a model that scores or selects among candidate options supplied in the request rather than generating free-form text. Typical uses are routing (which agent or tool handles a request), classification (judging a condition), and rubric scoring (ranking items against criteria).

Use DECISION instead of LLM when the output is a choice over inputs, not generated prose. Use EVALUATOR when the span scores a model's output for quality; use GUARDRAIL when it enforces a safety or policy check.

## Required Attributes

| Attribute | Type | Description | Required |
|-----------|------|-------------|----------|
| `openinference.span.kind` | String | Must be "DECISION" | Yes |

## Attributes

No decision-specific attributes are defined yet. Record what you have on the generic attributes: `input.value` for the request (including the candidate options), `output.value` for the selection or scores, and `metadata` for anything else. Do not assume Phoenix will render decision-specific cards.

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

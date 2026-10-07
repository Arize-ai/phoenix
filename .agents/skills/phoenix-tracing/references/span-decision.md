# DECISION Spans

## Purpose

DECISION spans represent a call to a decision model: a model that takes some state plus a fixed set of typed questions and returns a typed, probabilistic answer for each question, rather than generating free-form text. Typical uses are routing (which agent, tool, or department handles a request), classification (judging a condition), and rubric scoring (ranking items against ordered levels).

Known decision models: the OpenAI Decisions API (`client.decisions.create`, predicate / choice / score questions over text or images) and TypeSafe AI System One / Jev (Noul / Choice / Score questions). Both have OpenInference auto-instrumentors that emit DECISION spans (`openinference-instrumentation-openai` >= the Decisions release, `openinference-instrumentation-typesafe` >= 0.1.4 in Python and >= 0.4.1 in TypeScript).

Use DECISION instead of LLM when the output is a choice over caller-supplied options, not generated prose. Use EVALUATOR when the span scores a model's output for quality; use GUARDRAIL when it enforces a safety or policy check.

## Required Attributes

| Attribute | Type | Description | Required |
|-----------|------|-------------|----------|
| `openinference.span.kind` | String | Must be "DECISION" | Yes |
| `decision.system` | String | The decision API the call conforms to: `openai` for the OpenAI Decisions API, `typesafe` for System One. Shares the well-known values of `llm.system`. | Yes |

## Attributes

Decision spans identify the model under `decision.*`, never `llm.*`, so decision-model usage is not counted or priced as LLM usage.

| Attribute | Type | Description |
|-----------|------|-------------|
| `decision.provider` | String | Who hosts the model, when it differs from the system (e.g. `azure`, or a self-hosted deployment). Shares the well-known values of `llm.provider`. |
| `decision.model_name` | String | The model that answered (e.g. `gpt-6-luna`, `jev-1.13.0`). Mirrors `llm.model_name`. |
| `decision.request.model_name` | String | The model the caller requested, when it can differ from the one that answered (e.g. the alias `jev-latest`). |
| `decision.response.model_name` | String | The model the provider reports as having answered. |
| `decision.token_count.input` | Integer | Input tokens: state, questions, and candidate options. |
| `decision.token_count.output` | Integer | Output tokens; usually tiny because answers are typed values. No prompt/completion split and no total. |
| `input.value` / `input.mime_type` | String | The raw request as JSON (`application/json`), including the candidate options. |
| `output.value` / `output.mime_type` | String | The raw response as JSON (`application/json`), including the selection, probabilities, or scores. |

Do not set `llm.input_messages`, `llm.output_messages`, `llm.system`, `llm.provider`, `llm.model_name`, or `llm.token_count.*` on a decision span.

Phoenix renders DECISION spans with their own icon and a dedicated span view: the input and output cards, with the decision model named in the input card header (from `decision.model_name`, then `decision.response.model_name`, then `decision.request.model_name`) and led by the provider icon when `decision.provider` is one Phoenix knows.

## Instrumentation

Prefer the auto-instrumentors above. For a manual span, set the kind and the `decision.*` attributes directly:

```python
from openinference.semconv.trace import SpanAttributes

with tracer.start_as_current_span(
    "route-request", openinference_span_kind="decision"
) as span:
    span.set_attribute(SpanAttributes.DECISION_SYSTEM, "openai")
    span.set_attribute(SpanAttributes.DECISION_PROVIDER, "openai")
    span.set_attribute(SpanAttributes.DECISION_REQUEST_MODEL_NAME, "gpt-6-luna")
    span.set_input(request)  # the state and the typed questions
    response = decide(request)
    span.set_attribute(SpanAttributes.DECISION_RESPONSE_MODEL_NAME, response.model)
    span.set_attribute(SpanAttributes.DECISION_MODEL_NAME, response.model)
    span.set_attribute(SpanAttributes.DECISION_TOKEN_COUNT_INPUT, response.usage.input_tokens)
    span.set_attribute(SpanAttributes.DECISION_TOKEN_COUNT_OUTPUT, response.usage.output_tokens)
    span.set_output(response)  # the typed answers
```

```typescript
import { traceDecision } from "@arizeai/openinference-core";
import { SemanticConventions } from "@arizeai/openinference-semantic-conventions";

const route = traceDecision(routeRequest, {
  name: "route-request",
  attributes: {
    [SemanticConventions.DECISION_SYSTEM]: "openai",
    [SemanticConventions.DECISION_PROVIDER]: "openai",
    [SemanticConventions.DECISION_MODEL_NAME]: "gpt-6-luna",
  },
});
```

`traceDecision` is `withSpan` with `kind` pre-set to `DECISION`; it is also re-exported from `@arizeai/phoenix-otel`.

See the OpenInference [decision spans specification](https://github.com/Arize-ai/openinference/blob/main/spec/decision_spans.md) for the system-versus-provider rules and a worked example.

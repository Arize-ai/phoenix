---
type: llm
focus: {source: file, path: acme_llm_span.py}
weight: 0.5
---
The user wants calls to a non-instrumented LLM provider to appear in Phoenix as a proper LLM span with model, input/output messages, and token counts, following OpenInference conventions.

Grade exactly one claim. PASS if the claim below holds, FAIL otherwise. Ignore everything else about the file.

Claim: The code creates an OpenInference LLM span (span kind LLM — via `@tracer.llm`, `OpenInferenceSpanKind.LLM`, or the `OPENINFERENCE_SPAN_KIND` attribute) and records the model and token counts using OpenInference `llm.*` attribute names (e.g. `llm.model_name`, `llm.token_count.*`, and `llm.input_messages`/`llm.output_messages` or the matching `SpanAttributes.LLM_*` constants), rather than ad-hoc attribute names. Minor omissions (e.g. not every message field) are fine as long as it is clearly an OpenInference LLM span using `llm.*` attributes.

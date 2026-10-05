---
type: llm
focus: {source: file, path: acme_llm_span.py}
weight: 0.5
---
The user wants calls to a non-instrumented LLM provider to appear in Phoenix as a proper LLM span with model, input/output messages, and token counts, following OpenInference conventions.

Grade exactly one claim. PASS if the claim below holds, FAIL otherwise. Ignore everything else about the file.

Claim: The span is an LLM span (openinference span kind LLM, e.g. via `@tracer.llm` or an explicit span-kind attribute) and it records the model, the messages, and the token counts using the OpenInference attribute names (`llm.model_name`, `llm.input_messages.*` / `llm.output_messages.*`, `llm.token_count.prompt`/`completion`/`total`) — not ad-hoc attribute names of the model's own choosing.

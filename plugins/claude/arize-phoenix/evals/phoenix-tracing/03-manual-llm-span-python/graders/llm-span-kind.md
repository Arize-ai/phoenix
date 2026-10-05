---
type: regex
target: {source: file, path: acme_llm_span.py}
match: contains
---
@tracer\.llm|openinference\.span\.kind|OpenInferenceSpanKind\.LLM|SpanAttributes\.OPENINFERENCE_SPAN_KIND

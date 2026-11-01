---
type: regex
target: {source: file, path: acme_llm_span.py}
match: contains
---
llm\.token_count|llm\.model_name|llm\.input_messages|SpanAttributes\.LLM_TOKEN_COUNT|SpanAttributes\.LLM_MODEL_NAME

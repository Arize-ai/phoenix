---
type: regex
target: {source: file, path: weather_tool.py}
match: contains
---
@tracer\.tool|start_as_current_span|OpenInferenceSpanKind|SpanAttributes|openinference\.span\.kind

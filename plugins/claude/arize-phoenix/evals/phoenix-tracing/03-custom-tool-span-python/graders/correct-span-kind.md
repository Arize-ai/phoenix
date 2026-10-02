---
type: llm
focus: {source: file, path: weather_tool.py}
weight: 0.5
---
The user wants their `get_weather` function to appear in Phoenix as a TOOL span following OpenInference conventions, capturing input and output.

Grade exactly one claim. PASS if the claim below holds, FAIL otherwise. Ignore everything else about the file.

Claim: The function is instrumented as a TOOL span specifically — via the `@tracer.tool` decorator, or a span whose OpenInference span kind is set to TOOL — not as a generic/untyped span or a different kind (chain, llm, etc.).

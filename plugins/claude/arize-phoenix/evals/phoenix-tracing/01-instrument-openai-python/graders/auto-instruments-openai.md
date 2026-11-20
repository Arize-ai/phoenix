---
type: regex
target: {source: file, path: tracing_setup.py}
match: contains
---
auto_instrument\s*=\s*True|OpenAIInstrumentor|openinference-instrumentation-openai|openinference\.instrumentation\.openai

# Phoenix Tracing: Auto-Instrumentation (Python)

**Automatically create spans for LLM calls without code changes.**

## Overview

Auto-instrumentation patches supported libraries at runtime to create spans automatically. Use for supported frameworks (LangChain, LlamaIndex, OpenAI SDK, etc.). For custom logic, manual-instrumentation-python.md.

## Supported Frameworks

**Python:**

- LLM SDKs: OpenAI, Anthropic, Bedrock, Mistral, Vertex AI, Groq, Ollama
- Frameworks: LangChain, LlamaIndex, DSPy, CrewAI, Instructor, Haystack
- Install: `pip install openinference-instrumentation-{name}`

## Setup

**Install and enable:**

```bash
pip install arize-phoenix-otel
pip install openinference-instrumentation-openai  # Add others as needed
```

```python
from phoenix.otel import register

register(project_name="my-app", auto_instrument=True)  # Discovers all installed instrumentors
```

**Example:**

```python
from phoenix.otel import register
from openai import OpenAI

register(project_name="my-app", auto_instrument=True)

client = OpenAI()
response = client.chat.completions.create(
    model="gpt-4",
    messages=[{"role": "user", "content": "Hello!"}]
)
```

Traces appear in Phoenix UI with model, input/output, tokens, timing automatically captured. See span kind files for full attribute schemas.

**Selective instrumentation** (explicit control):

```python
from phoenix.otel import register
from openinference.instrumentation.openai import OpenAIInstrumentor

tracer_provider = register(project_name="my-app")  # No auto_instrument
OpenAIInstrumentor().instrument(tracer_provider=tracer_provider)
```

## Limitations

Auto-instrumentation does NOT capture:

- Custom business logic
- Internal function calls
- Non-OpenInference attributes

**Example:**

```python
def my_custom_workflow(query: str) -> str:
    preprocessed = preprocess(query)  # Not traced
    response = client.chat.completions.create(...)  # Traced (auto)
    postprocessed = postprocess(response)  # Not traced
    return postprocessed
```

**Solution:** Add manual instrumentation:

```python
@tracer.chain
def my_custom_workflow(query: str) -> str:
    preprocessed = preprocess(query)
    response = client.chat.completions.create(...)
    postprocessed = postprocess(response)
    return postprocessed
```

## Troubleshooting

**No traces:**

- Check instrumentor installed: `pip list | grep openinference`
- Check `auto_instrument=True` in `register()`
- Check `PHOENIX_COLLECTOR_ENDPOINT` matches Phoenix server

**Missing attributes:**

- Update instrumentor: `pip install --upgrade openinference-instrumentation-openai`
- Check library version compatibility
- Add manual instrumentation for custom logic

**Conflicts:**

- Use selective instrumentation and only enable needed instrumentors

## Combining Auto + Manual

```python
tracer_provider = register(project_name="my-app", auto_instrument=True)
tracer = tracer_provider.get_tracer(__name__)

client = OpenAI()  # Auto-instrumented

@tracer.chain
def my_workflow(query: str) -> str:
    preprocessed = preprocess(query)
    response = client.chat.completions.create(...)  # Auto-instrumented
    return postprocess(response)
```

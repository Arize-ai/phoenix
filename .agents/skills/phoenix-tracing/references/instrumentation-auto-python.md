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

## OTel GenAI Native Instrumentation

Phoenix automatically converts [OTel GenAI semantic convention](https://opentelemetry.io/docs/specs/semconv/gen-ai/) attributes (`gen_ai.*`) to OpenInference when receiving OTLP spans. This means you can use **OTel-native AI instrumentation** — any library that emits `gen_ai.*` attributes — without installing OpenInference instrumentors, and Phoenix will display spans with proper LLM span kind, model names, token counts, and message content.

If a span already has OpenInference attributes set (e.g. from a dual-emitting instrumentor), those values take precedence over the synthesized ones.

No client-side changes required. Send OTLP to Phoenix as usual:

```python
from phoenix.otel import register

# Works with any OTel-native AI instrumentor that emits gen_ai.* attributes
register(project_name="my-app")
```

**OTel GenAI packages** (from [opentelemetry-python-genai](https://github.com/open-telemetry/opentelemetry-python-genai/tree/main/instrumentation)):

- `opentelemetry-instrumentation-anthropic`
- `opentelemetry-instrumentation-openai`

```bash
pip install opentelemetry-instrumentation-anthropic
```

```python
from phoenix.otel import register
from opentelemetry.instrumentation.anthropic import AnthropicInstrumentor
import anthropic

register(project_name="my-app")

# Instrument Anthropic
AnthropicInstrumentor().instrument()

# Use Anthropic client as normal — spans are created automatically
client = anthropic.Anthropic()
response = client.messages.create(
    model="claude-3-5-sonnet-20241022",
    max_tokens=1024,
    messages=[
        {"role": "user", "content": "Hello, Claude!"}
    ]
)
```

## Limitations

Auto-instrumentation does NOT capture:

- Custom business logic
- Internal function calls

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

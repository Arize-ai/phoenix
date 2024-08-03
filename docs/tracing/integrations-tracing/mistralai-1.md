---
description: Instrument LLM applications that use the Guardrails AI framework
---

# Guardrails AI

In this example we will instrument a small program that uses the [Guardrails AI](https://www.guardrailsai.com/) framework to protect their LLM calls.

## Install

```bash
pip install openinference-instrumentation-guardrails guardrails-ai
```

## Setup

Set up [OpenTelemetry to point to a running Phoenix Instance](https://docs.arize.com/phoenix/quickstart) and then initialize the GuardrailsAIInstrumentor before your application code.

```python
from openinference.instrumentation.guardrails import GuardrailsInstrumentor

GuardrailsInstrumentor().instrument()
```

## Run Guardrails

From here, you can run Guardrails as normal:

```python
from guardrails import Guard
from guardrails.hub import TwoWords
import openai

guard = Guard().use(
    TwoWords(),
)
response = guard(
    llm_api=openai.chat.completions.create,
    prompt="What is another name for America?",
    model="gpt-3.5-turbo",
    max_tokens=1024,
)

print(response)

```

## Observe

Now that you have tracing setup, all invocations of underlying models used by Guardrails (completions, chat completions, embeddings) will be streamed to your running Phoenix for observability and evaluation. Additionally, Guards will be present as a new span kind in Phoenix.

## Resources

* [Example notebook](https://github.com/Arize-ai/dataset-embeddings-guardrails/blob/main/validator/arize\_demo\_dataset\_embeddings\_guard.ipynb)
* [OpenInference package](https://github.com/Arize-ai/openinference/blob/main/python/instrumentation/openinference-instrumentation-guardrails)

---
description: Instrument LLM applications that use the Guardrails AI framework
---

# Guardrails AI Tracing

{% embed url="https://www.youtube.com/watch?v=o5bo9P3WW7k" %}

In this example we will instrument a small program that uses the [Guardrails AI](https://www.guardrailsai.com/) framework to protect their LLM calls.

## Launch Phoenix

{% include "../../../../phoenix-integrations/.gitbook/includes/sign-up-for-phoenix-sign-up....md" %}

## Install

```bash
pip install openinference-instrumentation-guardrails guardrails-ai
```

## Setup

Connect to your Phoenix instance using the register function.

```python
from phoenix.otel import register

# configure the Phoenix tracer
tracer_provider = register(
  project_name="my-llm-app", # Default is 'default'
  auto_instrument=True # Auto-instrument your app based on installed OI dependencies
)
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

* [Example notebook](https://github.com/Arize-ai/dataset-embeddings-guardrails/blob/main/validator/arize_demo_dataset_embeddings_guard.ipynb)
* [OpenInference package](https://github.com/Arize-ai/openinference/blob/main/python/instrumentation/openinference-instrumentation-guardrails)

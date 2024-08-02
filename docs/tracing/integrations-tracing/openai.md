---
description: >-
  How to use the python OpenAIInstrumentor to trace OpenAI LLM and embedding
  calls
---

# OpenAI

{% hint style="info" %}
Note: This instrumentation also works with Azure OpenAI
{% endhint %}

Phoenix provides auto-instrumentation for the [OpenAI Python Library](https://github.com/openai/openai-python).

## Install

```bash
pip install openinference-instrumentation-openai openai
```

## Setup

Setup OpenTelemetry to point to a running Phoenix and then initialize the OpenAIInstrumentor before your application code.

```python
from openinference.instrumentation.openai import OpenAIInstrumentor

OpenAIInstrumentor().instrument()
```

## Run OpenAI

```python
import openai

client = openai.OpenAI()
response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Write a haiku."}],
)
print(response.choices[0].message.content)
```

## Observe

Now that you have tracing setup, all invocations of OpenAI (completions, chat completions, embeddings) will be streamed to your running Phoenix for observability and evaluation.

## Resources

* [Example notebook](https://github.com/Arize-ai/phoenix/blob/main/tutorials/tracing/openai\_tracing\_tutorial.ipynb)
* [OpenInference package](https://github.com/Arize-ai/openinference/tree/main/python/instrumentation/openinference-instrumentation-openai)
* [Working examples](https://github.com/Arize-ai/openinference/tree/main/python/instrumentation/openinference-instrumentation-openai/examples)


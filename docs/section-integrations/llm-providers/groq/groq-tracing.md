---
description: Instrument LLM applications built with Groq
---

# Groq Tracing

[Groq](http://groq.com/) provides low latency and lightning-fast inference for AI models. Arize supports instrumenting Groq API calls, including role types such as system, user, and assistant messages, as well as tool use. You can create a free GroqCloud account and [generate a Groq API Key here](https://console.groq.com) to get started.

## Launch Phoenix

## Install

```bash
pip install openinference-instrumentation-groq groq
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

## Run Groq

A simple Groq application that is now instrumented

```python
import os
from groq import Groq

client = Groq(
    # This is the default and can be omitted
    api_key=os.environ.get("GROQ_API_KEY"),
)

chat_completion = client.chat.completions.create(
    messages=[
        {
            "role": "user",
            "content": "Explain the importance of low latency LLMs",
        }
    ],
    model="mixtral-8x7b-32768",
)
print(chat_completion.choices[0].message.content)
```

## Observe

Now that you have tracing setup, all invocations of pipelines will be streamed to your running Phoenix for observability and evaluation.

## Resources:

* [Example Chat Completions](https://github.com/Arize-ai/openinference/blob/main/python/instrumentation/openinference-instrumentation-groq/examples/chat_completions.py)
* [Example Async Chat Completions](https://github.com/Arize-ai/openinference/blob/main/python/instrumentation/openinference-instrumentation-groq/examples/async_chat_completions.py)
* [Tutorial](https://github.com/Arize-ai/phoenix/blob/main/tutorials/tracing/groq_tracing_tutorial.ipynb)
* [OpenInference package](https://github.com/Arize-ai/openinference/tree/main/python/instrumentation/openinference-instrumentation-groq)

# Anthropic Tracing

Anthropic is a leading provider for state-of-the-art LLMs. The Anthropic SDK can be instrumented using the [`openinference-instrumentation-anthropic`](https://github.com/Arize-ai/openinference/tree/main/python/instrumentation/openinference-instrumentation-anthropic) package.

## Install

```bash
pip install openinference-instrumentation-anthropic anthropic
```

## Setup

Use the register function to connect your application to Phoenix:

```python
from phoenix.otel import register

# configure the Phoenix tracer
tracer_provider = register(
  project_name="my-llm-app", # Default is 'default'
  auto_instrument=True # Auto-instrument your app based on installed OI dependencies
)
```

## Run Anthropic

A simple Anthropic application that is now instrumented

```python
import anthropic

client = anthropic.Anthropic()

message = client.messages.create(
    model="claude-3-5-sonnet-20240620",
    max_tokens=1000,
    temperature=0,
    messages=[
        {
            "role": "user",
            "content": [
                {
                    "type": "text",
                    "text": "Why is the ocean salty?"
                }
            ]
        }
    ]
)
print(message.content)
```

## Observe

Now that you have tracing setup, all invocations of pipelines will be streamed to your running Phoenix for observability and evaluation.

## Resources:

* [Example Messages](https://github.com/Arize-ai/openinference/blob/main/python/instrumentation/openinference-instrumentation-anthropic/examples/sync_messages.py)
* [Example Tool Calling](https://github.com/Arize-ai/openinference/blob/main/python/instrumentation/openinference-instrumentation-anthropic/examples/multiple_tool_calling.py)
* [OpenInference package](https://github.com/Arize-ai/openinference/tree/main/python/instrumentation/openinference-instrumentation-anthropic)

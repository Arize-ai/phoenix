---
description: Instrument LLM calls made using Anthropic's SDK
---

# Anthropic

Anthropic is a leading provider for state-of-the-art LLMs. The Anthropic SDK can be instrumented using the [`openinference-instrumentation-anthropic`](https://github.com/Arize-ai/openinference/tree/main/python/instrumentation/openinference-instrumentation-anthropic) package.

{% tabs %}
{% tab title="Python" %}
In this example we will instrument a small program that uses the MistralAI chat completions API and observe the traces in Arize.

Copy

```sh
pip install openinference-instrumentation-anthropic anthropic arize-otel opentelemetry-sdk opentelemetry-exporter-grpc
```

Set the `MISTRAL_API_KEY` environment variable to authenticate calls made using the SDK.

Copy

```sh
export ANTHROPIC_API_KEY=[your_key_here]
```

In a python file, setup the `AnthropicInstrumentor` and configure the tracer to send traces to Arize.

Copy

```python
# Import open-telemetry dependencies
from arize_otel import register_otel, Endpoints

# Setup OTEL via our convenience function
register_otel(
    endpoints = Endpoints.ARIZE,
    space_id = "your-space-id", # in app space settings page
    api_key = "your-api-key", # in app space settings page
    model_id = "your-model-id", # name this to whatever you would like
)

# Import openinference instrumentor to map Mistral traces to a standard format
from openinference.instrumentation.anthropic import AnthropicInstrumentor

# Turn on the instrumentor
AnthropicInstrumentor().instrument()
```

To test, run the following code and observe your traces in Arize.

Copy

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
{% endtab %}
{% endtabs %}

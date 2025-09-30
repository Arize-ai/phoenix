# OpenRouter Tracing

Phoenix provides auto-instrumentation for OpenRouter through the OpenAI Python Library since OpenRouter provides a fully OpenAI-compatible API endpoint.

## Install

```bash
pip install openinference-instrumentation-openai openai
```

## Setup

Add your OpenAI API key as an environment variable:

```bash
export OPENAI_API_KEY='your_openrouter_api_key'
```

Use the register function to connect your application to Phoenix:

```python
from phoenix.otel import register

# configure the Phoenix tracer
tracer_provider = register(
  project_name="my-llm-app", # Default is 'default'
  auto_instrument=True # Auto-instrument your app based on installed dependencies
)
```

## Run OpenRouter

```python
import openai

client = openai.OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key="your_openrouter_api_key"
)

response = client.chat.completions.create(
    model="meta-llama/llama-3.1-8b-instruct:free",
    messages=[{"role": "user", "content": "Write a haiku about observability."}],
)
print(response.choices[0].message.content)
```

## Observe

Now that you have tracing setup, all invocations of OpenAI (completions, chat completions, embeddings) will be streamed to your running Phoenix for observability and evaluation.

## What Gets Traced

All OpenRouter model calls are automatically traced and include:

* Request/response data and timing
* Model name and provider information
* Token usage and cost data (when supported)
* Error handling and debugging information

## Common Issues

* **API Key**: Use your OpenRouter API key, not OpenAI's
* **Model Names**: Use exact model names from [OpenRouter's documentation](https://openrouter.ai/models)
* **Rate Limits**: Check your [OpenRouter dashboard](https://openrouter.ai/keys) for usage limits
* **Base URL**: Ensure you're using `https://openrouter.ai/api/v1` as the base URL\


## Resources

* [OpenRouter Documentation](https://openrouter.ai/docs)
* [OpenInference OpenAI Instrumentation](https://github.com/Arize-ai/openinference/tree/main/python/instrumentation/openinference-instrumentation-openai)

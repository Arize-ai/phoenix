---
description: >-
  Trace OpenRouter API calls with Phoenix auto-instrumentation using OpenAI-compatible
  endpoints for comprehensive LLM observability and monitoring.
---

# OpenRouter Tracing

Phoenix provides auto-instrumentation for OpenRouter API calls using OpenAI-compatible endpoints for comprehensive LLM observability and monitoring.

OpenInference provides auto-instrumentation for OpenRouter through the OpenAI Python Library since OpenRouter provides a fully OpenAI-compatible API endpoint. This allows you to use the same instrumentation and monitoring capabilities as OpenAI for tracing 200+ open-source and proprietary LLMs.

## Why OpenRouter Works with Phoenix

Phoenix's OpenInference auto-instrumentation works seamlessly with OpenRouter because:

- **OpenAI Compatibility**: OpenRouter exposes a `/v1` endpoint that mirrors OpenAI's schema exactly
- **Reuse Official SDKs**: Point the OpenAI client's `base_url` to OpenRouter for instant compatibility
- **Automatic Instrumentation**: OpenInference hooks into OpenAI SDK calls seamlessly without code changes
- **Comprehensive Coverage**: Trace all 200+ models available through OpenRouter with the same setup

{% hint style="info" %}
**Note**: OpenRouter exposes a `/v1` endpoint that mirrors OpenAI's schema, making it fully compatible with OpenAI SDKs and OpenInference auto-instrumentation.
{% endhint %}

## Prerequisites

- [OpenRouter account](https://openrouter.ai/) and API key
- Phoenix instance (Cloud, Docker, or local)

## Launch Phoenix

We have several code samples below on different ways to integrate with OpenRouter, based on how you want to use Phoenix.

{% include "../../../../phoenix-integrations/.gitbook/includes/sign-up-for-phoenix-sign-up....md" %}

## Install

```bash
pip install openinference-instrumentation-openai openai
```

## Setup

Set your OpenRouter API key:

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

Configure the OpenAI client to work with OpenRouter by setting the base URL:

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

Now that you have tracing setup, all invocations of OpenRouter (completions, chat completions, embeddings) will be streamed to your running Phoenix for observability and evaluation.

## Supported Models

OpenRouter provides access to 200+ models including:

- **Open Source Models**: Llama 3.1, Mistral, Qwen, CodeLlama, and more
- **Proprietary Models**: GPT-4, Claude, Gemini, and other commercial models
- **Specialized Models**: Code generation, image analysis, and domain-specific models

All models are automatically traced with the same setup, providing consistent observability across your entire model portfolio.

## What Gets Traced

All OpenRouter model calls are automatically traced and include:

- **Request/response data and timing** - Complete request and response payloads with precise timing metrics
- **Model name and provider information** - Detailed model identification and provider metadata
- **Token usage and cost data** - Token consumption and cost tracking (when supported by the model)
- **Error handling and debugging information** - Comprehensive error tracking and debugging context
- **Performance metrics** - Latency, throughput, and other performance indicators
- **Session tracking** - User session and conversation context

## JavaScript/TypeScript Support

OpenInference also provides instrumentation for the OpenAI JS/TS SDK, which works with OpenRouter. For setup and examples, please refer to the [OpenInference JS examples for OpenAI](https://github.com/Arize-ai/openinference/tree/main/javascript/instrumentation/openinference-instrumentation-openai).

## Common Issues

- **API Key**: Use your OpenRouter API key, not OpenAI's
- **Model Names**: Use exact model names from [OpenRouter's model documentation](https://openrouter.ai/models)
- **Rate Limits**: Check your [OpenRouter dashboard](https://openrouter.ai/keys) for usage limits
- **Base URL**: Ensure you're using `https://openrouter.ai/api/v1` as the base URL
- **Model Availability**: Some models may have limited availability or require special access

## Resources

* [OpenRouter Documentation](https://openrouter.ai/docs) - Complete API reference and guides
* [OpenRouter Models](https://openrouter.ai/models) - Available models and pricing
* [OpenInference OpenAI Instrumentation](https://github.com/Arize-ai/openinference/tree/main/python/instrumentation/openinference-instrumentation-openai) - GitHub repository
* [Working examples](https://github.com/Arize-ai/openinference/tree/main/python/instrumentation/openinference-instrumentation-openai/examples) - Code examples and tutorials
* [Phoenix Documentation](https://arize.com/docs/phoenix) - Complete Phoenix observability platform docs

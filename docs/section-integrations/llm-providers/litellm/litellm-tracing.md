# LiteLLM Tracing

[LiteLLM](https://github.com/BerriAI/litellm) allows developers to call all LLM APIs using the openAI format. [LiteLLM Proxy](https://docs.litellm.ai/docs/simple_proxy) is a proxy server to call 100+ LLMs in OpenAI format. Both are supported by this auto-instrumentation.

Any calls made to the following functions will be automatically captured by this integration:

* completion()
* acompletion()
* completion\_with\_retries()
* embedding()
* aembedding()
* image\_generation()
* aimage\_generation()

## Launch Phoenix

{% include "../../../../phoenix-integrations/.gitbook/includes/sign-up-for-phoenix-sign-up....md" %}

## Install

```bash
pip install openinference-instrumentation-litellm litellm
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

Add any API keys needed by the models you are using with LiteLLM.

```python
import os
os.environ["OPENAI_API_KEY"] = "PASTE_YOUR_API_KEY_HERE"
```

## Run LiteLLM

You can now use LiteLLM as normal and calls will be traces in Phoenix.

```python
import litellm
completion_response = litellm.completion(model="gpt-3.5-turbo",
                   messages=[{"content": "What's the capital of China?", "role": "user"}])
print(completion_response)
```

## Observe

Traces should now be visible in Phoenix!

## Resources

* [OpenInference Instrumentation](https://github.com/Arize-ai/openinference/tree/main/python/instrumentation/openinference-instrumentation-litellm)

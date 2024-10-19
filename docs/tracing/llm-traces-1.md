# Quickstart: Tracing

## Overview

Tracing is a powerful tool for understanding the behavior of your LLM application. Phoenix has best-in-class tracing, regardless of what framework you use, and has first-class instrumentation for a variety of frameworks (LlamaIndex, LangChain, DSPy), SDKs (OpenAI, Bedrock, Mistral, Vertex), and Languages (Python, Javascript). You can also manually instrument your application using the OpenTelemetry SDK.

This example will walk you through how to use Phoenix to trace OpenAI requests.

{% embed url="https://colab.research.google.com/github/Arize-ai/phoenix/blob/main/tutorials/quickstarts/tracing_quickstart_openai.ipynb" %}

## Install Dependencies

Let's start by installing the necessary dependencies.

```python
!pip install -q "arize-phoenix>=4.29.0"
```

## Launch Phoenix

You have a few options for how to start a Phoenix app. We're using a cloud instance for this tutorial, but you can launch Phoenix in multiple different ways. If you don't want to sign up for a cloud instance, you can start a Phoenix app in your notebook environment or via docker.

```python
# Check if PHOENIX_API_KEY is present in the environment variables.
# If it is, we'll use the cloud instance of Phoenix. If it's not, we'll start a local instance.
# A third option is to connect to a docker or locally hosted instance.
# See https://docs.arize.com/phoenix/setup/environments for more information.

import os

if "PHOENIX_API_KEY" in os.environ:
    os.environ["PHOENIX_CLIENT_HEADERS"] = f"api_key={os.environ['PHOENIX_API_KEY']}"
    os.environ["PHOENIX_COLLECTOR_ENDPOINT"] = "https://app.phoenix.arize.com"

else:
    import phoenix as px

    px.launch_app().view()
```

Now that we have Phoenix configured, we can register that instance with OpenTelemetry, which will allow us to collect traces from our application here.

```python
from phoenix.otel import register

tracer_provider = register()
```

## Instrument your application

Now we need to indicate which methods and attributes we want to trace. Phoenix has a number of built-in tracers for popular frameworks, and provides tools to manually instrument your application if needed. See [here for a list of integrations](https://docs.arize.com/phoenix/tracing/integrations-tracing)

Here we're using OpenAI, so we'll install the built-in OpenAI instrumentor we provide.

```python
!pip install -q openinference-instrumentation-openai openai
```

## Use OpenAI as normal

From here we can use OpenAI as normal. All of our requests will be traced and reported to Phoenix automatically.

```python
# Add OpenAI API Key
import os
from getpass import getpass

if not (openai_api_key := os.getenv("OPENAI_API_KEY")):
    openai_api_key = getpass("🔑 Enter your OpenAI API key: ")

os.environ["OPENAI_API_KEY"] = openai_api_key
```

```python
import openai

client = openai.OpenAI()
response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Write a haiku."}],
)
print(response.choices[0].message.content)
```

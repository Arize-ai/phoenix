# Quickstart: Tracing

## Overview

Tracing is a powerful tool for understanding the behavior of your LLM application. Phoenix has best-in-class tracing, regardless of what framework you use, and has first-class instrumentation for a variety of frameworks (LlamaIndex, LangChain, DSPy), SDKs (OpenAI, Bedrock, Mistral, Vertex), and Languages (Python, Javascript). You can also manually instrument your application using the OpenTelemetry SDK.

This example will walk you through how to use Phoenix to trace OpenAI requests.

{% embed url="https://colab.research.google.com/github/Arize-ai/phoenix/blob/main/tutorials/quickstarts/tracing_quickstart_openai.ipynb" %}

### Overview

```python
!pip install -q "arize-phoenix>=4.29.0"
```

## Launch Phoenix

```bash
pip install openai
```

```python
import phoenix as px
from phoenix.trace.openai import OpenAIInstrumentor

# To view traces in Phoenix, you will first have to start a Phoenix server. You can do this by running the following:
session = px.launch_app()

# Initialize OpenAI auto-instrumentation
OpenAIInstrumentor().instrument()

import os
from openai import OpenAI

# Initialize an OpenAI client
client = OpenAI(api_key='')

# Define a conversation with a user message
conversation = [
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user", "content": "Hello, can you help me with something?"}
]

# Generate a response from the assistant
response = client.chat.completions.create(
    model="gpt-3.5-turbo",
    messages=conversation,
)

# Extract and print the assistant's reply
# The traces will be available in the Phoenix App for the above messsages
assistant_reply = response.choices[0].message.content
```

To use llama-index's one click, you must install the small integration first:

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

Here we're using OpenAI, so we'll the built-in OpenAI instrumentor we provide.

```python
!pip install -q openinference-instrumentation-openai openai
```

See the [integration guide](integrations-tracing/langchain.md#traces) for details



\*\*Install packages:\*\*

```bash
pip install arize-phoenix openinference-instrumentation-groq groq
```

**Launch Phoenix:**

```python
import phoenix as px
px.launch_app()
```

**Connect your notebook to Phoenix:**

```python
from phoenix.otel import register

tracer_provider = register(
  project_name="my-llm-app", # Default is 'default'
)
```

**Initialize the GroqInstrumentor before your application code.**

```python
from openinference.instrumentation.groq import GroqInstrumentor

GroqInstrumentor().instrument(tracer_provider=tracer_provider)
```

**Run Groq**

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

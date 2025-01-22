---
description: Phoenix can be accessed via our website or self-hosted.
---

# Quickstart

{% tabs %}
{% tab title="☁️  Phoenix Developer Edition" %}
### Create an account and retrieve API key

1. Create an account on the [**Phoenix website**](https://app.phoenix.arize.com/)
2. Grab your API key from the "Keys" section of the site

<figure><img src=".gitbook/assets/Screenshot 2024-10-29 at 2.28.28 PM.png" alt=""><figcaption></figcaption></figure>

### Connect your app to Phoenix

To collect traces from your application, you must configure an OpenTelemetry TracerProvider to send traces to Phoenix. The `register` utility from the `phoenix.otel` module streamlines this process.

```bash
pip install arize-phoenix
```

Connect your application to your cloud instance using:

```python
import os
from phoenix.otel import register

# Add Phoenix API Key for tracing
PHOENIX_API_KEY = "ADD YOUR API KEY"
os.environ["PHOENIX_CLIENT_HEADERS"] = f"api_key={PHOENIX_API_KEY}"
os.environ["PHOENIX_COLLECTOR_ENDPOINT"] = "https://app.phoenix.arize.com"

# configure the Phoenix tracer
tracer_provider = register() 
```

Your app is now connected to Phoenix! Any OpenTelemetry traces you generate will be sent to your Phoenix instance.

### Instrument your app and trace a request

Let's generate some of those traces now. We'll use OpenAI in this example, but Phoenix has [dozens of other integrations](tracing/integrations-tracing/) to choose from as well.

First we'll import our instrumentor and the OpenAI package:

```bash
pip install openinference-instrumentation-openai openai
```

Then enable our OpenAI integration:

```python
from openinference.instrumentation.openai import OpenAIInstrumentor

OpenAIInstrumentor().instrument(tracer_provider=tracer_provider)
```

And finally send a request to OpenAI:

```python
import openai
import os

os.environ["OPENAI_API_KEY"] = "YOUR OPENAI API KEY"

client = openai.OpenAI()
response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Write a haiku."}],
)
print(response.choices[0].message.content)
```

### View traces in Phoenix

You should now see traces in Phoenix!

<figure><img src=".gitbook/assets/Screenshot 2024-10-29 at 2.51.24 PM.png" alt=""><figcaption></figcaption></figure>
{% endtab %}

{% tab title="🖥️  Run Phoenix Locally" %}
### Launch a local version of Phoenix

You can use Phoenix's open-source package to launch a local instance of Phoenix on your machine. For more info on other self-hosting options, like Docker, see [deployment](deployment/ "mention")

First, install the Phoenix package:

```bash
pip install arize-phoenix
```

Then launch your instance in terminal:

```bash
phoenix serve
```

### Connect your app to Phoenix

To collect traces from your application, you must configure an OpenTelemetry TracerProvider to send traces to Phoenix. The `register` utility from the `phoenix` module streamlines this process.

Connect your application to your cloud instance using:

```python
import os
from phoenix.otel import register

# If you have set up auth on your local Phoenix instance, include:
PHOENIX_API_KEY = "ADD YOUR API KEY"
os.environ["PHOENIX_CLIENT_HEADERS"] = f"api_key={PHOENIX_API_KEY}"
os.environ["PHOENIX_API_KEY] = "{PHOENIX_API_KEY}"

# configure the Phoenix tracer
tracer_provider = register(
  endpoint="http://localhost:4317",  # Sends traces using gRPC
) 
```

Your app is now connected to Phoenix! Any OpenTelemetry traces you generate will be sent to your Phoenix instance.

### Instrument your app and trace a request

Let's generate some of those traces now. We'll use OpenAI in this example, but Phoenix has [dozens of other integrations](tracing/integrations-tracing/) to choose from as well.

First we'll import our instrumentor and the OpenAI package:

```bash
pip install openinference-instrumentation-openai openai 'httpx<0.28'
```

Then enable our OpenAI integration:

```python
from openinference.instrumentation.openai import OpenAIInstrumentor

OpenAIInstrumentor().instrument(tracer_provider=tracer_provider)
```

And finally send a request to OpenAI:

```python
import openai
import os

os.environ["OPENAI_API_KEY"] = "YOUR OPENAI API KEY"

client = openai.OpenAI()
response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Write a haiku."}],
)
print(response.choices[0].message.content)
```

### View traces in Phoenix

You should now see traces in Phoenix!

<figure><img src=".gitbook/assets/Screenshot 2024-10-29 at 2.51.24 PM.png" alt=""><figcaption></figcaption></figure>
{% endtab %}
{% endtabs %}

## Next Steps

* View more details on [tracing](tracing/llm-traces-1.md)&#x20;
* Run [evaluations](evaluation/evals.md) on traces
* Test changes to you prompts, models, and application via [experiments](datasets-and-experiments/how-to-experiments/run-experiments.md)
* Explore [other hosting options](deployment/) for Phoenix

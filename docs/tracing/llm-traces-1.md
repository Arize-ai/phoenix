# Quickstart: Tracing

## Overview

Tracing is a powerful tool for understanding the behavior of your LLM application. Phoenix has best-in-class tracing, regardless of what framework you use, and has first-class instrumentation for a variety of frameworks (LlamaIndex, LangChain, DSPy), SDKs (OpenAI, Bedrock, Mistral, Vertex), and Languages (Python, Javascript). You can also manually instrument your application using the OpenTelemetry SDK.

This example will walk you through how to use Phoenix to trace OpenAI requests.

## Install & Launch Phoenix

Let's start by installing Phoenix. You have a few options for how to do this:

{% tabs %}
{% tab title="Phoenix Developer Edition" %}
The easiest way to use Phoenix is by accessing a free persistent instance provided on our site. Sign up for an Arize Phoenix account at [https://app.phoenix.arize.com/login](https://app.phoenix.arize.com/login)

Once you're there, grab your API key from the Keys option on the left bar:

<figure><img src="../.gitbook/assets/Screenshot 2024-10-29 at 2.28.28 PM.png" alt=""><figcaption></figcaption></figure>
{% endtab %}

{% tab title="Self-host" %}
If you'd rather run Phoenix locally, you can instead use one of our self-hosting options. For more detail on each of these, see [deployment](../deployment/ "mention")

### Using Terminal

Install the Phoenix package:

```bash
pip install arize-phoenix
```

Launch the Phoenix client:

```bash
phoenix serve
```

This will expose the Phoenix UI and REST API on `localhost:6006` and exposes the gRPC endpoint for spans on `localhost:4317`

### **Using Docker**

Phoenix server images are available via [Docker Hub](https://hub.docker.com/r/arizephoenix/phoenix) and can be used via [docker compose ](https://docs.arize.com/phoenix/deployment/docker)or if you simply want a long-running phoenix instance to share with your team.

```bash
docker pull arizephoenix/phoenix:latest
```

Launch the phoenix docker image using:

```
docker run -p 6006:6006 -p 4317:4317 arizephoenix/phoenix:latest
```

This will expose the Phoenix UI and REST API on `localhost:6006` and exposes the gRPC endpoint for spans on `localhost:4317`
{% endtab %}

{% tab title="Run in Notebook" %}
As a final option, you can run a temporary version of Phoenix directly in your notebook.

Install Phoenix using:

```bash
pip install arize-phoenix
```

Within your notebook, launch Phoenix using:

```python
import phoenix as px
px.launch_app()
```

{% hint style="info" %}
By default, notebook instances do not have persistent storage, so your traces will disappear after the notebook is closed. See [Persistence](https://docs.arize.com/phoenix/deployment/persistence) or use one of the other deployment options to retain traces.
{% endhint %}
{% endtab %}
{% endtabs %}

## Connect your application <a href="#connect-your-app" id="connect-your-app"></a>

To collect traces from your application, you must configure an OpenTelemetry TracerProvider to send traces to Phoenix. The `register` utility from the `phoenix.otel` module streamlines this process.

{% tabs %}
{% tab title="Phoenix Developer Edition" %}
If `arize-phoenix` is not installed in your python environment, you can use `arize-phoenix-otel` to quickly connect to your phoenix instance.

```bash
pip install arize-phoenix-otel
```

Connect your application to your cloud instance using:

```python
import os
from phoenix.otel import register

# Add Phoenix API Key for tracing
PHOENIX_API_KEY = "ADD YOUR API KEY"
os.environ["PHOENIX_CLIENT_HEADERS"] = f"api_key={PHOENIX_API_KEY}"

# configure the Phoenix tracer
register(
  project_name="my-llm-app", # Default is 'default'
  endpoint="https://app.phoenix.arize.com/v1/traces",
)
```
{% endtab %}

{% tab title="Self-host" %}
If `arize-phoenix` is not installed in your python environment, you can use `arize-phoenix-otel` to quickly connect to your phoenix instance.

```bash
pip install arize-phoenix-otel
```

Connect your application to your instance using:

```python
from phoenix.otel import register

# defaults to endpoint="http://localhost:4317"
register(
  project_name="my-llm-app", # Default is 'default'
  endpoint="http://localhost:4317",  # Sends traces using gRPC
)  
```

{% hint style="info" %}
You do not have to use phoenix.otel to connect to your phoenix instance, you can use OpenTelemetry itself to initialize your OTEL connection. See [Using OTEL Python Directly](https://docs.arize.com/phoenix/tracing/how-to-tracing/setup-tracing/setup-tracing-python/using-otel-python-directly)
{% endhint %}

See [Setup Tracing: Python](https://docs.arize.com/phoenix/tracing/how-to-tracing/setup-tracing/setup-tracing-python) for more details on configuration and setup
{% endtab %}

{% tab title="Notebook" %}
Connect your notebook to Phoenix:

```python
from phoenix.otel import register

# defaults to endpoint="http://localhost:4317"
register(
  project_name="my-llm-app", # Default is 'default'
  endpoint="http://localhost:4317",  # Sends traces using gRPC
) 
```
{% endtab %}
{% endtabs %}

## Instrument your application

Now we need to indicate which methods and attributes we want to trace. Phoenix has a number of built-in tracers for popular frameworks, and provides tools to manually instrument your application if needed. See [here for a list of integrations](https://docs.arize.com/phoenix/tracing/integrations-tracing)

Here we're using OpenAI, so we'll install the built-in OpenAI instrumentor we provide.

```bash
pip install -q openinference-instrumentation-openai openai getpass
```

Initialize the OpenAIInstrumentor before your application code:

```python
from openinference.instrumentation.openai import OpenAIInstrumentor

OpenAIInstrumentor().instrument(tracer_provider=tracer_provider)
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

## View your Traces in Phoenix

You should now see traces in Phoenix!

<figure><img src="../.gitbook/assets/Screenshot 2024-10-29 at 2.51.24 PM.png" alt=""><figcaption></figcaption></figure>

## Next Steps:

* View more details on [configuring your tracing](llm-traces/)
* Run [evaluations](../evaluation/evals.md) on traces
* Test changes to you prompts, models, and application via [experiments](../datasets-and-experiments/how-to-experiments/run-experiments.md)
* Explore [other hosting options](../deployment/) for Phoenix

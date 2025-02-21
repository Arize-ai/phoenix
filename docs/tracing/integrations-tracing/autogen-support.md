# AutoGen

{% embed url="https://colab.research.google.com/github/Arize-ai/phoenix/blob/main/tutorials/tracing/autogen_tutorial.ipynb" %}

AutoGen is an agent framework from Microsoft that allows for complex Agent creation. It is unique in its ability to create multiple agents that work together.

<figure><img src="../../.gitbook/assets/autogen_agentchat.png" alt=""><figcaption><p>AutoGen</p></figcaption></figure>

The AutoGen Agent framework allows creation of multiple agents and connection of those agents to work together to accomplish tasks.

## Launch Phoenix

{% tabs %}
{% tab title="Phoenix Developer Edition" %}
**Sign up for Phoenix:**

Sign up for an Arize Phoenix account at [https://app.phoenix.arize.com/login](https://app.phoenix.arize.com/login)

**Install packages:**

```bash
pip install arize-phoenix-otel
```

**Connect your application to your cloud instance:**

```python
import os
from phoenix.otel import register

# Add Phoenix API Key for tracing
PHOENIX_API_KEY = "ADD YOUR API KEY"
os.environ["PHOENIX_CLIENT_HEADERS"] = f"api_key={PHOENIX_API_KEY}"
os.environ["PHOENIX_COLLECTOR_ENDPOINT"] = "https://app.phoenix.arize.com"

# configure the Phoenix tracer
tracer_provider = register(
  project_name="my-llm-app", # Default is 'default'
) 
```

Your **Phoenix API key** can be found on the Keys section of your [dashboard](https://app.phoenix.arize.com).
{% endtab %}

{% tab title="Command Line" %}
**Launch your local Phoenix instance:**

```bash
pip install arize-phoenix
phoenix serve
```

For details on customizing a local terminal deployment, see [Terminal Setup](https://docs.arize.com/phoenix/setup/environments#terminal).

**Install packages:**

```bash
pip install arize-phoenix-otel
```

**Connect your application to your instance using:**

```python
from phoenix.otel import register

tracer_provider = register(
  project_name="my-llm-app", # Default is 'default'
  endpoint="http://localhost:6006/v1/traces",
)
```

See [deploying-phoenix.md](../../deployment/deploying-phoenix.md "mention") for more details
{% endtab %}

{% tab title="Docker" %}
**Pull latest Phoenix image from** [**Docker Hub**](https://hub.docker.com/r/arizephoenix/phoenix)**:**

```bash
docker pull arizephoenix/phoenix:latest
```

**Run your containerized instance:**

```bash
docker run -p 6006:6006 arizephoenix/phoenix:latest
```

This will expose the Phoenix on `localhost:6006`

**Install packages:**

```bash
pip install arize-phoenix-otel
```

**Connect your application to your instance using:**

```python
from phoenix.otel import register

tracer_provider = register(
  project_name="my-llm-app", # Default is 'default'
  endpoint="http://localhost:6006/v1/traces",
)
```

For more info on using Phoenix with Docker, see [#docker](autogen-support.md#docker "mention")
{% endtab %}

{% tab title="Notebook" %}
**Install packages:**

```bash
pip install arize-phoenix
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

{% hint style="info" %}
By default, notebook instances do not have persistent storage, so your traces will disappear after the notebook is closed. See [persistence.md](../../deployment/persistence.md "mention") or use one of the other deployment options to retain traces.
{% endhint %}
{% endtab %}
{% endtabs %}

## Install

Phoenix instruments Autogen by instrumenting the underlying model library it's using. If your agents are set up to call OpenAI, use our OpenAI instrumentor per the example below.

If your agents are using a different model, be sure to instrument that model instead.

```shell
pip install openinference-instrumentation-openai arize-phoenix-otel arize-phoenix
```

## Setup

Then instrument the application:

```python
from openinference.instrumentation.openai import OpenAIInstrumentor

OpenAIInstrumentor().instrument(tracer_provider=tracer_provider)
```

## Run Autogen

From here you can use Autogen as normal, and Phoenix will automatically trace any model calls made.

## Observe

The Phoenix support is simple in its first incarnation but allows for capturing all of the prompt and responses that occur under the framework between each agent.

<figure><img src="../../.gitbook/assets/auto_gen_phoenix.png" alt=""><figcaption><p>Agent Reply</p></figcaption></figure>

The individual prompt and responses are captured directly through OpenAI calls. If you're using a different underlying model provider than OpenAI, instrument your application using the respective instrumentor instead.

## Resources:

* [Example notebook](https://github.com/Arize-ai/phoenix/blob/main/tutorials/tracing/autogen_tutorial.ipynb)


# LiteLLM

[LiteLLM](https://github.com/BerriAI/litellm) allows developers to call all LLM APIs using the openAI format. [LiteLLM Proxy](https://docs.litellm.ai/docs/simple\_proxy) is a proxy server to call 100+ LLMs in OpenAI format. Both are supported by this auto-instrumentation.

Any calls made to the following functions will be automatically captured by this integration:

* completion()
* acompletion()
* completion\_with\_retries()
* embedding()
* aembedding()
* image\_generation()
* aimage\_generation()

## Launch Phoenix

{% tabs %}
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

{% tab title="Command Line" %}
**Launch your local Phoenix instance:**

```bash
python3 -m phoenix.server.main serve
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

For more info on using Phoenix with Docker, see [#docker](litellm.md#docker "mention")
{% endtab %}

{% tab title="app.phoenix.arize.com" %}
If you don't want to host an instance of Phoenix yourself or use a notebook instance, you can use a persistent instance provided on our site. Sign up for an Arize Phoenix account at[https://app.phoenix.arize.com/login](https://app.phoenix.arize.com/login)

**Install packages:**

```bash
pip install arize-phoenix-otel
```

**Connect your application to your cloud instance:**

```python
import os
from phoenix.otel import register

# Add Phoenix API Key for tracing
os.environ["PHOENIX_CLIENT_HEADERS"] = "api_key=...:..."

# configure the Phoenix tracer
register(
  project_name="my-llm-app", # Default is 'default'
  endpoint="https://app.phoenix.arize.com/v1/traces",
)
```

Your **Phoenix API key** can be found on the Keys section of your [dashboard](https://app.phoenix.arize.com).
{% endtab %}
{% endtabs %}

## Install

```bash
pip install openinference-instrumentation-litellm litellm
```

## Setup

Initialize the InstructorInstrumentor before your application code.

```python
from openinference.instrumentation.litellm import LiteLLMInstrumentor

LiteLLMInstrumentor().instrument(tracer_provider=tracer_provider)
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

<figure><img src="../../.gitbook/assets/Screenshot 2024-10-08 at 9.59.25 AM.png" alt=""><figcaption><p>A LiteLLM trace in Phoenix</p></figcaption></figure>

## Resources

* [OpenInference Instrumentation](https://github.com/Arize-ai/openinference/tree/main/python/instrumentation/openinference-instrumentation-litellm)




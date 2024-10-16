# Hosted Phoenix

{% embed url="https://www.youtube.com/watch?embeds_referring_euri=https://cdn.iframe.ly/&feature=emb_title&source_ve_path=MjM4NTE&v=LLKMxeGcZCA" %}

We now offer a hosted version of Phoenix to make it easier for developers to use Phoenix to trace their LLM applications and avoid setting up infrastructure.

### Example Notebooks:

* [Tracing an OpenAI app](https://colab.research.google.com/github/Arize-ai/phoenix/blob/main/tutorials/hosted\_phoenix/hosted\_phoenix\_openai\_tutorial.ipynb)
* [Tracing a LlamaIndex app](https://colab.research.google.com/github/Arize-ai/phoenix/blob/main/tutorials/hosted\_phoenix/hosted\_phoenix\_llamaindex\_tutorial.ipynb)

### The main differences for Hosted Phoenix:

Hosted Phoenix runs the latest version of our open source package and gates access to your data behind API keys and user authentication.

1. [You must create an account](hosted-phoenix.md#how-to-create-an-account)
2. [You need to add an API key as an environment variable during tracing](hosted-phoenix.md#how-to-send-in-your-first-trace)
3. [You need to add an API key as an environment variable when using the Client SDK](hosted-phoenix.md#using-the-client-sdk)

We also use 3rd party analytics tools to measure usage of our application to improve our services.

### How to create an account

Click signup on [phoenix.arize.com](https://app.phoenix.arize.com). We offer logins via Google, Github, and email. This account will use the same account credentials as your Arize account if you have one.

<figure><img src="../.gitbook/assets/image (1).png" alt=""><figcaption></figcaption></figure>

### Tracing: How to send in your first trace

<figure><img src="../.gitbook/assets/image.png" alt=""><figcaption></figcaption></figure>

Get your API keys from your Phoenix application on the left hand side.&#x20;

Here's the full sample code to trace a LlamaIndex and OpenAI application. Using a different framework? Hosted Phoenix works with [all of our automatic tracing options](../tracing/how-to-tracing/instrumentation/) as well.

{% tabs %}
{% tab title="LlamaIndex" %}
Install the following libraries

```
!pip install arize-phoenix "openai>=1" "openinference-instrumentation-llama-index>=2.0.0" llama_index
```

Use the following python code to start instrumentation.

```python
import os
from openinference.instrumentation.llama_index import LlamaIndexInstrumentor
from phoenix.otel import register

PHOENIX_API_KEY = "YOUR PHOENIX API KEY"
os.environ["PHOENIX_CLIENT_HEADERS"] = f"api_key={PHOENIX_API_KEY}"
os.environ["PHOENIX_COLLECTOR_ENDPOINT"] = "https://app.phoenix.arize.com"

# Configuration is picked up from your environment variables
tracer_provider = register()

# Instrument LlamaIndex. This allows Phoenix to collect traces from LlamaIndex queries.
LlamaIndexInstrumentor().instrument(tracer_provider=tracer_provider, skip_dep_check=True)
```
{% endtab %}

{% tab title="OpenAI" %}
Install the following libraries

```bash
! pip install arize-phoenix-otel openinference-instrumentation-openai openai
```

Use the following python code to connect to Phoenix

```python
from openinference.instrumentation.openai import OpenAIInstrumentor
from phoenix.otel import register
import os

PHOENIX_API_KEY = "YOUR PHOENIX API KEY"
os.environ["PHOENIX_CLIENT_HEADERS"] = f"api_key={PHOENIX_API_KEY}"
os.environ["PHOENIX_COLLECTOR_ENDPOINT"] = "https://app.phoenix.arize.com"

# Setup OTEL tracing for hosted Phoenix. The register function will automatically detect the endpoint and headers from your environment variables.
tracer_provider = register()

# Turn on instrumentation for OpenAI
OpenAIInstrumentor().instrument(tracer_provider=tracer_provider, skip_dep_check=True)
```
{% endtab %}
{% endtabs %}

### Using the Client SDK (downloading data & uploading datasets)

Once you collect trace data from the above configuration, you can access the data using the client SDK. You can also upload datasets for experiments using the client SDK.

You'll need to add the following environment variable to authenticate to hosted Phoenix.

```python
os.environ["PHOENIX_CLIENT_HEADERS"] = f"api_key=..."
os.environ["PHOENIX_COLLECTOR_ENDPOINT"] = "https://app.phoenix.arize.com"

import phoenix as px

px_client = px.Client()
phoenix_df = px_client.get_spans_dataframe()
```

## FAQ

### Will hosted Phoenix be on the latest version of Phoenix?

We update the Phoenix version used by Hosted Phoenix on a weekly basis.

### Data retention

We have a 30 day data retention policy. We are working on plans to offer a longer data retention period.

### Sharing

Currently accounts are setup to be used specifically for one developer. We will be adding ways to share your traces with other developers on your team shortly!

### Pricing

Hosted Phoenix is free for all developers. We will add a paid tier in the future which increases your data retention and also give you access to more storage.

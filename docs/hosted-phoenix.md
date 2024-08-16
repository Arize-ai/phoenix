# Hosted Phoenix

{% embed url="https://www.youtube.com/watch?embeds_referring_euri=https://cdn.iframe.ly/&feature=emb_title&source_ve_path=MjM4NTE&v=LLKMxeGcZCA" %}

We now offer a hosted version of Phoenix to make it easier for developers to use Phoenix to trace their LLM applications and avoid setting up infrastructure. You can use our Colab links to follow along.

| Framework                  |                                                                                                                                                                 |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Llamaindex                 | [Colab](https://colab.research.google.com/gist/exiao/7306d3c22a1f914650e8b23451859110/hosted-phoenix.ipynb?authuser=2#scrollTo=u4-cym\_JUfow)                   |
| Llamaindex with Llamacloud | [Colab](https://colab.research.google.com/github/run-llama/llamacloud-demo/blob/main/examples/tracing/llamacloud\_tracing\_phoenix.ipynb#scrollTo=mLtP7bOsCkVt) |
| OpenAI                     | [Colab](https://colab.research.google.com/gist/exiao/322535cb53c28d2871e78e98ea10c060/hosted-phoenix.ipynb?authuser=2#scrollTo=rUObjr\_Eww9x)                   |

### The main differences for Hosted Phoenix:

Hosted Phoenix runs the latest version of our open source package and gates access to your data behind API keys and user authentication.

1. [You must create an account](hosted-phoenix.md#how-to-create-an-account)
2. [You need to add an API key as an environment variable during tracing](hosted-phoenix.md#how-to-send-in-your-first-trace)
3. [You need to add an API key as an environment variable when using the Client SDK](hosted-phoenix.md#using-the-client-sdk)

We also use 3rd party analytics tools to measure usage of our application to improve our services.

### How to create an account

Click signup on [phoenix.arize.com](https://app.phoenix.arize.com). We offer logins via Google, Github, and email. This account will use the same account credentials as your Arize account if you have one.

<figure><img src=".gitbook/assets/image (1).png" alt=""><figcaption></figcaption></figure>

### Tracing: How to send in your first trace

<figure><img src=".gitbook/assets/image.png" alt=""><figcaption></figcaption></figure>

Get your API keys from your Phoenix application on the left hand side.&#x20;

Here's the full sample code for LlamaIndex and OpenAI instrumentation. You can see all of our automatic tracing options [here](tracing/how-to-tracing/instrumentation/).

{% tabs %}
{% tab title="LlamaIndex" %}
Install the following libraries

```
!pip install opentelemetry-sdk opentelemetry-exporter-otlp
!pip install "arize-phoenix[evals,llama-index]" "openai>=1" gcsfs nest-asyncio "openinference-instrumentation-llama-index>=2.0.0"
```

Use the following python code to start instrumentation.

```python
from opentelemetry import trace as trace_api
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk import trace as trace_sdk
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from openinference.instrumentation.llama_index import LlamaIndexInstrumentor

# Setup authentication and endpoint
os.environ["OTEL_EXPORTER_OTLP_HEADERS"] = f"api_key={PHOENIX_API_KEY}"
endpoint = "https://app.phoenix.arize.com/v1/traces"

# Setup tracing with OpenTelemetry
span_phoenix_processor = SimpleSpanProcessor(OTLPSpanExporter(endpoint=endpoint))
tracer_provider = trace_sdk.TracerProvider()
tracer_provider.add_span_processor(span_processor=span_phoenix_processor)

# Start instrumentation
LlamaIndexInstrumentor().instrument(tracer_provider=tracer_provider, skip_dep_check=True)
```

Checkout our colab tutorial here:

{% embed url="https://colab.research.google.com/gist/exiao/7306d3c22a1f914650e8b23451859110/hosted-phoenix.ipynb" %}
{% endtab %}

{% tab title="OpenAI" %}
Install the following libraries

```bash
pip install arize-otel openinference-instrumentation-openai openai
```

Then, use our library `arize-otel`, which sets up OpenTelemetry tracing with Hosted Phoenix. Run the following code to start instrumentation.

```python
import os
from arize_otel import register_otel, Endpoints
from openinference.instrumentation.openai import OpenAIInstrumentor

# Setup OTEL tracing for hosted Phoenix
# Endpoints.HOSTED_PHOENIX = "https://app.phoenix.arize.com"
PHOENIX_API_KEY = os.environ["PHOENIX_API_KEY"]
register_otel(
    endpoints=[Endpoints.HOSTED_PHOENIX],
    api_key=PHOENIX_API_KEY
)

# Turn on instrumentation for OpenAI
OpenAIInstrumentor().instrument()
```

Checkout our colab tutorial here:

{% embed url="https://colab.research.google.com/gist/exiao/322535cb53c28d2871e78e98ea10c060/hosted-phoenix.ipynb" %}
{% endtab %}
{% endtabs %}

### Using the Client SDK (downloading data & uploading datasets)

Once you collect trace data from the above configuration, you can access the data using the client SDK. You can also upload datasets for experiments using the client SDK.

You'll need to add the following environment variable to authenticate to hosted Phoenix.

```python
os.environ["PHOENIX_CLIENT_HEADERS"] = "api_key=..."
```

Here's more sample code.

```python
os.environ["PHOENIX_CLIENT_HEADERS"] = f"api_key=..."
os.environ["PHOENIX_COLLECTOR_ENDPOINT"] = "https://app.phoenix.arize.com"

import phoenix as px

px_client = px.Client()
phoenix_df = px_client.get_spans_dataframe()
```

## FAQ

### Will hosted Phoenix be on the latest version of Phoenix?

On account creation, we will always use the latest version of Phoenix. We try to keep all instances of hosted Phoenix up to date and run upgrades for them when new versions are available. There will be a few minutes of downtime during these periods.

### Data retention

We have a 30 day data retention policy. We are working on plans to offer a longer data retention period.

### Sharing

Currently accounts are setup to be used specifically for one developer. We will be adding ways to share your traces with other developers on your team shortly!

### Pricing

Hosted Phoenix is free for all developers. We will add a paid tier in the future which increases your data retention and also give you access to more storage.

### Are there other demos available?

Yes. This demo and [accompanying blog](https://arize.com/blog/how-to-host-phoenix-persistence/) show how to deploy Phoenix via Docker/Kubernetes:

{% embed url="https://www.youtube.com/watch?v=9hNrosMqirQ" %}

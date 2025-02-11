---
description: Phoenix can be accessed via our website or self-hosted.
---

# Quickstart

## Launch and Connect to the Phoenix App

To access the Phoenix app, you can either sign up for a free Phoenix Cloud account, or run the application locally.

{% tabs %}
{% tab title="☁️ Phoenix Cloud" %}
### Create an account and retrieve API key

1. Create an account on the [**Phoenix website**](https://app.phoenix.arize.com/)
2. Grab your API key from the "Keys" section of the site

<figure><img src=".gitbook/assets/Screenshot 2024-10-29 at 2.28.28 PM.png" alt=""><figcaption><p>Accessing your API key</p></figcaption></figure>

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
{% endtab %}

{% tab title="🖥️ Run Locally" %}
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
{% endtab %}
{% endtabs %}

## Instrument your Application

Now that your app is connected to Phoenix, you'll need to instrument your application to send traces.

You have two main options for instrumentation: Automatic or Manual.

{% tabs %}
{% tab title=" 🚀 Automatic Instrumentation" %}
Phoenix's [auto-instrumentors](tracing/integrations-tracing/) allow you to easily trace all calls made to a specified framework.

For example, OpenAI:

First, import the instrumentor and OpenAI package:

```bash
pip install openinference-instrumentation-openai openai
```

Then enable the OpenAI integration:

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
{% endtab %}

{% tab title="⚙️ Manual Instrumentation" %}
Manual instrumentation gives you fine-grain control over exactly which calls to trace, and which attributes to send to Phoenix.

```python
# retrieve the tracer object
tracer = tracer_provider.get_tracer(__name__)

# add the @tracer decorator to automatically trace your function
@tracer.chain
def my_func(input: str) -> str:
    return "output"
    
# or use a with clause to trace a block of code
with tracer.start_as_current_span(
    "my-span-name",
    openinference_span_kind="chain",
) as span:
    span.set_input("input")
    span.set_output("output")
    span.set_status(Status(StatusCode.OK))
```

For more information on manual tracing, see [setup-tracing-python.md](tracing/how-to-tracing/setup-tracing-python.md "mention") or [javascript.md](tracing/how-to-tracing/javascript.md "mention")
{% endtab %}
{% endtabs %}

### View traces in Phoenix

You should now see traces in Phoenix!

<figure><img src=".gitbook/assets/Screenshot 2024-10-29 at 2.51.24 PM.png" alt=""><figcaption></figcaption></figure>

## Next Steps

* View more details on [tracing](tracing/llm-traces-1.md)&#x20;
* Run [evaluations](evaluation/evals.md) on traces
* Test changes to you prompts, models, and application via [experiments](datasets-and-experiments/how-to-experiments/run-experiments.md)
* Explore [other hosting options](deployment/) for Phoenix

# Quickstart: Tracing (Python)

## Overview

Phoenix supports three main options to collect traces:

1. Use [Phoenix's decorators](../how-to-tracing/setup-tracing/instrument-python.md) to mark functions and code blocks.
2. Use [automatic instrumentation](https://arize.com/docs/phoenix/integrations) to capture all calls made to supported frameworks.
3. Use [base OpenTelemetry ](../how-to-tracing/setup-tracing/custom-spans.md)instrumentation. Supported in [Python](../how-to-tracing/setup-tracing/custom-spans.md) and [TS / JS](../how-to-tracing/setup-tracing/javascript.md), among many other languages.

This example uses options 1 and 2.

## Launch Phoenix

{% tabs %}
{% tab title="Using Phoenix Cloud" %}
1. Sign up for an Arize Phoenix account at [https://app.phoenix.arize.com/login](https://app.phoenix.arize.com/login)
2. Grab your API key from the Keys option on the left bar.
3. In your code, set your endpoint and API key:

```python
import os

# Add Phoenix API Key for tracing
PHOENIX_API_KEY = "ADD YOUR API KEY"
PHOENIX_ENDPOINT = "https://app.phoenix.arize.com/v1/traces"

os.environ["PHOENIX_CLIENT_HEADERS"] = f"api_key={PHOENIX_API_KEY}"
```

{% hint style="warning" %}
Having trouble finding your endpoint? Check out [Finding your Phoenix Endpoint](https://arize.com/docs/phoenix/learn/faqs/what-is-my-phoenix-endpoint)
{% endhint %}
{% endtab %}

{% tab title="Using Self-hosted Phoenix" %}
1. Run Phoenix using Docker, local terminal, Kubernetes etc. For more information, [see self-hosting](https://arize.com/docs/phoenix/self-hosting).
2. In your code, set your endpoint:

```python
import os

# Update this with your self-hosted endpoint
PHOENIX_ENDPOINT = "http://0.0.0.0:6006/v1/traces"
```

{% hint style="warning" %}
Having trouble finding your endpoint? Check out [Finding your Phoenix Endpoint](https://arize.com/docs/phoenix/learn/faqs/what-is-my-phoenix-endpoint)
{% endhint %}
{% endtab %}
{% endtabs %}

## Connect to Phoenix <a href="#connect-your-app" id="connect-your-app"></a>

To collect traces from your application, you must configure an OpenTelemetry TracerProvider to send traces to Phoenix.

```bash
pip install arize-phoenix-otel
```

```python
from phoenix.otel import register

# configure the Phoenix tracer
tracer_provider = register(
  project_name="my-llm-app", # Default is 'default'
  auto_instrument=True, # See 'Trace all calls made to a library' below
  endpoint=PHOENIX_ENDPOINT,
)
tracer = tracer_provider.get_tracer(__name__)
```

## Trace your own functions

Functions can be traced using decorators:

```python
@tracer.chain
def my_func(input: str) -> str:
    return "output"
```

Input and output attributes are set automatically based on `my_func`'s parameters and return.

## Trace all calls made to a library

Phoenix can also capture all calls made to supported libraries automatically. Just install the [respective OpenInference library](../integrations-tracing/):

```
pip install openinference-instrumentation-openai
```

{% hint style="warning" %}
OpenInference libraries must be installed _**before**_ calling the register function
{% endhint %}

```python
# Add OpenAI API Key
import os
import openai

os.environ["OPENAI_API_KEY"] = "ADD YOUR OPENAI API KEY"

client = openai.OpenAI()
response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Write a haiku."}],
)
print(response.choices[0].message.content)
```

## View your Traces in Phoenix

You should now see traces in Phoenix!

<figure><img src="../../.gitbook/assets/Screenshot 2024-10-29 at 2.51.24 PM.png" alt=""><figcaption></figcaption></figure>

## Next Steps

* Explore tracing [integrations](https://arize.com/docs/phoenix/integrations)
* [Customize tracing](../how-to-tracing/)
* View use cases to see[ end-to-end examples](https://arize.com/docs/phoenix/cookbook/guide)

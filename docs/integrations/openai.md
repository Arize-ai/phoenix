---
description: Instrument calls to the OpenAI Python Library
---

# OpenAI

The [OpenAI Python Library](https://github.com/openai/openai-python) implements Python bindings for OpenAI's popular suite of models. Phoenix provides utilities to instrument calls to OpenAI's API, enabling deep observability into the behavior of an LLM application build on top on these models.

## Traces

[OpenInference](../tracing/instrumentation/open-inference.md) [Traces](../tracing/quickstart.md) collect telemetry data about the execution of your LLM application. Consider using this instrumentation to understand how a OpenAI model is being called inside a complex system and to troubleshoot issues such as extraction and response synthesis. These traces can also help debug operational issues such as rate limits, authentication issues or improperly set model parameters.

Phoenix currently supports calls to the `ChatCompletion` interface, but more are planned soon.&#x20;

{% hint style="info" %}
Have a OpenAI API you would like to see instrumented? Drop us a [GitHub issue!](https://github.com/Arize-ai/phoenix/issues)
{% endhint %}

To view OpenInference traces in Phoenix, you will first have to start a Phoenix server. You can do this by running the following:

```python
import phoenix as px
session = px.launch_app()
```

Once you have started a Phoenix server, you can instrument the `openai` Python library using the `OpenAIInstrumentor` class.

```python
from phoenix.trace.tracer import Tracer
from phoenix.trace.exporter import HttpExporter
from phoenix.trace.openai.instrumentor import OpenAIInstrumentor

OpenAIInstrumentor().instrument()
```

All subsequent calls to the `ChatCompletion` interface will now report informational spans to Phoenix. These traces and spans are viewable within the Phoenix UI.

```python
# View in the browser
px.active_session().url

# View in the notebook directy
px.active_session().view()
```

#### Saving Traces

If you would like to save your traces to a file for later use, you can directly extract the traces as a dataframe from Phoenix using `px.Client`.

```python
px.Client().get_spans_dataframe()
```

In this way, you can store and communicate interesting traces that you may want to use to share with a team or to use later down the line to fine-tune an LLM or model.

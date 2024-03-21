# OpenAI

{% hint style="info" %}
Note: This instrumentation also works with Azure OpenAI
{% endhint %}

Phoenix provides auto-instrumentation for the [OpenAI Python Library](https://github.com/openai/openai-python).

To view OpenAI spans in Phoenix, you will first have to start a Phoenix server. You can do this by running the following:

```python
import phoenix as px
session = px.launch_app()
```

Once you have started a Phoenix server, you can instrument the OpenAI Python library using the `OpenAIInstrumentor.`

```python
from phoenix.trace.tracer import Tracer
from phoenix.trace.exporter import HttpExporter
from phoenix.trace.openai.instrumentor import OpenAIInstrumentor

OpenAIInstrumentor().instrument()
```

All subsequent calls to `ChatCompletion` and  will now export spans to the Phoenix server. These spans will show up in the UI as they are collected.

```python
# View in the browser
px.active_session().url
```


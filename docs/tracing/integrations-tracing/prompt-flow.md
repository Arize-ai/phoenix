---
description: Create flows using Microsoft PromptFlow and send their traces to Phoenix
---

# Prompt flow

### Quickstart

In this tutorial we will use [Microsoft Prompt flow](https://github.com/microsoft/promptflow) to create flows and send their traces in to[`arize-phoenix`](https://github.com/Arize-ai/phoenix). We will tweak this Prompt flow [notebook](https://github.com/microsoft/promptflow/blob/main/examples/flex-flows/chat-basic/chat-with-class-based-flow.ipynb) which currently sends traces to the Prompt flow collector.

First install Phoenix and Prompt flow.

```
pip install arize-phoenix promptflow
```

In a python file or notebook, import and launch Phoenix.

```python
import phoenix as px
session = px.launch_app()
```

Then set up the OpenTelemetry endpoint to be Phoenix and use Prompt flow's `setup_exporter_from_environ` to start tracing any further flows and LLM calls.

```python
import os
from opentelemetry.sdk.environment_variables import OTEL_EXPORTER_OTLP_ENDPOINT
from promptflow.tracing._start_trace import setup_exporter_from_environ

endpoint = f"http://127.0.0.1:6006/v1/traces"
os.environ[OTEL_EXPORTER_OTLP_ENDPOINT] = endpoint
setup_exporter_from_environ()
```

Then proceed with creating Prompt flow flows as usual. In this example we use `flow.py`, `chat.prompty`, and a jupyter notebook, chat\_flow\_example.ipynb, that you can follow along with [here](https://github.com/Arize-ai/openinference/tree/main/python/instrumentation/openinference-instrumentation-promptflow/examples).

After you finish clicking through the notebook, you should see the spans render in Phoenix as shown in the below screenshots.

<div>

<figure><img src="../../.gitbook/assets/Chat flow example 1.png" alt=""><figcaption></figcaption></figure>

 

<figure><img src="../../.gitbook/assets/Chat flow example 2.png" alt=""><figcaption></figcaption></figure>

</div>

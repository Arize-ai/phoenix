---
description: How to use the python LlamaIndexInstrumentor to trace LlamaIndex
---

# LlamaIndex Tracing

{% embed url="https://colab.research.google.com/github/Arize-ai/phoenix/blob/main/tutorials/tracing/llama_index_tracing_tutorial.ipynb" %}
Troubleshooting an LLM application using the OpenInferenceTraceCallback
{% endembed %}

[LlamaIndex](https://github.com/run-llama/llama_index) is a data framework for your LLM application. It's a powerful framework by which you can build an application that leverages RAG (retrieval-augmented generation) to super-charge an LLM with your own data. RAG is an extremely powerful LLM application model because it lets you harness the power of LLMs such as OpenAI's GPT but tuned to your data and use-case.

For LlamaIndex, tracing instrumentation is added via an OpenTelemetry instrumentor aptly named the `LlamaIndexInstrumentor` . This callback is what is used to create spans and send them to the Phoenix collector.

## Launch Phoenix

Phoenix supports LlamaIndex's latest [instrumentation](https://docs.llamaindex.ai/en/stable/module_guides/observability/instrumentation/) paradigm. This paradigm requires LlamaIndex >= 0.10.43. For legacy support, see below.

{% include "../../../../phoenix-integrations/.gitbook/includes/sign-up-for-phoenix-sign-up....md" %}

## Install

```bash
pip install openinference-instrumentation-llama_index llama-index>=0.11.0
```

## Setup

Initialize the LlamaIndexInstrumentor before your application code.

```python
from openinference.instrumentation.llama_index import LlamaIndexInstrumentor
from phoenix.otel import register

tracer_provider = register()
LlamaIndexInstrumentor().instrument(tracer_provider=tracer_provider)
```

## Run LlamaIndex

You can now use LlamaIndex as normal, and tracing will be automatically captured and sent to your Phoenix instance.

```python
from llama_index.core import VectorStoreIndex, SimpleDirectoryReader
import os

os.environ["OPENAI_API_KEY"] = "YOUR OPENAI API KEY"

documents = SimpleDirectoryReader("data").load_data()
index = VectorStoreIndex.from_documents(documents)
query_engine = index.as_query_engine()
response = query_engine.query("Some question about the data should go here")
print(response)
```

## Observe

View your traces in Phoenix:

## Resources

* [Example notebook](https://github.com/Arize-ai/phoenix/blob/main/tutorials/tracing/llama_index_tracing_tutorial.ipynb)
* [Instrumentation Package](https://github.com/Arize-ai/openinference/tree/main/python/instrumentation/openinference-instrumentation-llama-index)

<details>

<summary>Legacy Integrations (&#x3C;0.10.43)</summary>

**Legacy One-Click (<0.10.43)**

Using phoenix as a callback requires an install of \`llama-index-callbacks-arize-phoenix>0.1.3'

llama-index 0.10 introduced modular sub-packages. To use llama-index's one click, you must install the small integration first:

```bash
pip install 'llama-index-callbacks-arize-phoenix>0.1.3'
```

```python
# Phoenix can display in real time the traces automatically
# collected from your LlamaIndex application.
import phoenix as px
# Look for a URL in the output to open the App in a browser.
px.launch_app()
# The App is initially empty, but as you proceed with the steps below,
# traces will appear automatically as your LlamaIndex application runs.

from llama_index.core import set_global_handler

set_global_handler("arize_phoenix")

# Run all of your LlamaIndex applications as usual and traces
# will be collected and displayed in Phoenix.
```

**Legacy (<0.10.0)**

If you are using an older version of llamaIndex (pre-0.10), you can still use phoenix. You will have to be using `arize-phoenix>3.0.0` and downgrade `openinference-instrumentation-llama-index<1.0.0`

```python
# Phoenix can display in real time the traces automatically
# collected from your LlamaIndex application.
import phoenix as px
# Look for a URL in the output to open the App in a browser.
px.launch_app()
# The App is initially empty, but as you proceed with the steps below,
# traces will appear automatically as your LlamaIndex application runs.

import llama_index
llama_index.set_global_handler("arize_phoenix")

# Run all of your LlamaIndex applications as usual and traces
# will be collected and displayed in Phoenix.
```

</details>

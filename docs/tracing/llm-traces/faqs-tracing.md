---
description: Frequently Asked Questions
---

# FAQs: Tracing

## How to log traces

To log traces, you must instrument your application either [manually](../how-to-tracing/manual-instrumentation/custom-spans.md) or [automatically](../how-to-tracing/instrumentation/). To log to a remote instance of Phoenix, you must also configure the host and port where your traces will be sent.

{% tabs %}
{% tab title="Local Phoenix" %}
When running running Phoenix locally on the default port of `6006`, no additional configuration is necessary.

```python
import phoenix as px
from phoenix.trace import LangChainInstrumentor

px.launch_app()

LangChainInstrumentor().instrument()

# run your LangChain application
```
{% endtab %}

{% tab title="Remote Phoenix" %}
If you are running a remote instance of Phoenix, you can configure your instrumentation to log to that instance using the `PHOENIX_HOST` and `PHOENIX_PORT` environment variables.

```python
import os
from phoenix.trace import LangChainInstrumentor

# assume phoenix is running at 162.159.135.42:6007
os.environ["PHOENIX_HOST"] = "162.159.135.42"
os.environ["PHOENIX_PORT"] = "6007"

LangChainInstrumentor().instrument()  # logs to http://162.159.135.42:6007

# run your LangChain application
```

Alternatively, you can use the `PHOENIX_COLLECTOR_ENDPOINT` environment variable.

```python
import os
from phoenix.trace import LangChainInstrumentor

# assume phoenix is running at 162.159.135.42:6007
os.environ["PHOENIX_COLLECTOR_ENDPOINT"] = "162.159.135.42:6007"

LangChainInstrumentor().instrument()  # logs to http://162.159.135.42:6007

# run your LangChain application
```
{% endtab %}
{% endtabs %}

## How to turn off tracing

Tracing can be paused temporarily or disabled permanently.

**Pause tracing using context manager**

If there is a section of your code for which tracing is not desired, e.g. the document chunking process, it can be put inside the `suppress_tracing` context manager as shown below.

```python
from phoenix.trace import suppress_tracing

with suppress_tracing():
    # Code running inside this block doesn't generate traces.
    # For example, running LLM evals here won't generate additional traces.
    ...
# Tracing will resume outside the block.
...
```

**Uninstrument the auto-instrumentors permanently**

Calling `.uninstrument()` on the auto-instrumentors will remove tracing permanently. Below is the examples for LangChain, LlamaIndex and OpenAI, respectively.

```python
LangChainInstrumentor().uninstrument()
LlamaIndexInstrumentor().uninstrument()
OpenAIInstrumentor().uninstrument()
# etc.
```

## For OpenAI, how do I get token counts when streaming?

To get token counts when streaming, install `openai>=1.26` and set `stream_options={"include_usage": True}` when calling `create`. Below is an example Python code snippet. For more info, see [here](https://community.openai.com/t/usage-stats-now-available-when-using-streaming-with-the-chat-completions-api-or-completions-api/738156).

```python
response = openai.OpenAI().chat.completions.create(
    model="gpt-3.5-turbo",
    messages=[{"role": "user", "content": "Write a haiku."}],
    max_tokens=20,
    stream=True,
    stream_options={"include_usage": True},
)
```

## Using a custom LangChain component

If you have customized a LangChain component (say a retriever), you might not get tracing for that component without some additional steps. Internally, instrumentation relies on components to inherit from LangChain base classes for the traces to show up. Below is an example of how to inherit from LanChain base classes to make a [custom retriever](https://python.langchain.com/v0.1/docs/modules/data\_connection/retrievers/custom\_retriever/) and to make traces show up.

```python
from typing import List

from langchain_core.callbacks import CallbackManagerForRetrieverRun
from langchain_core.retrievers import BaseRetriever, Document
from openinference.instrumentation.langchain import LangChainInstrumentor
from opentelemetry import trace as trace_api
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk import trace as trace_sdk
from opentelemetry.sdk.trace.export import SimpleSpanProcessor

PHOENIX_COLLECTOR_ENDPOINT = "http://127.0.0.1:6006/v1/traces"
tracer_provider = trace_sdk.TracerProvider()
trace_api.set_tracer_provider(tracer_provider)
tracer_provider.add_span_processor(SimpleSpanProcessor(OTLPSpanExporter(endpoint)))

LangChainInstrumentor().instrument()


class CustomRetriever(BaseRetriever):
    """
    This example is taken from langchain docs.
    https://python.langchain.com/v0.1/docs/modules/data_connection/retrievers/custom_retriever/
    A custom retriever that contains the top k documents that contain the user query.
    This retriever only implements the sync method _get_relevant_documents.
    If the retriever were to involve file access or network access, it could benefit
    from a native async implementation of `_aget_relevant_documents`.
    As usual, with Runnables, there's a default async implementation that's provided
    that delegates to the sync implementation running on another thread.
    """

    k: int
    """Number of top results to return"""

    def _get_relevant_documents(
        self, query: str, *, run_manager: CallbackManagerForRetrieverRun
    ) -> List[Document]:
        """Sync implementations for retriever."""
        matching_documents: List[Document] = []

        # Custom logic to find the top k documents that contain the query

        for index in range(self.k):
            matching_documents.append(Document(page_content=f"dummy content at {index}", score=1.0))
        return matching_documents


retriever = CustomRetriever(k=3)


if __name__ == "__main__":
    documents = retriever.invoke("what is the meaning of life?")
```

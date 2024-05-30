---
description: Frequently Asked Questions
---

# FAQs: Tracing

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

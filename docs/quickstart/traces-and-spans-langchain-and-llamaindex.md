# LLM Traces - LangChain & LlamaIndex

## LangChain and LlamaIndex Streaming

The easiest method of using Phoenix with LangChain and LlamaIndex is by streaming.

An instantiation of LangChain and LlamaIndex can be directed to store traces in an OpenInference store.

This store can be:

* In Memory of Notebook: Local and ephemeral useful for quick debugging.
* Local File (coming very soon): Persistent and good for offline local development.
* Cloud (coming very soon): Persistent and cloud friendly. Store in your cloud buckets.

```python
from phoenix.trace.langchain import OpenInferenceTracer
import phoenix as px

px.launch_app()
```

The above launches a phoenix instance that captures trace data in an open inference memory buffer.

```markup
🌍 To view the Phoenix app in your browser, visit https://z8rwookkcle1-496ff2e9c6d22116-6060-colab.googleusercontent.com/
📺 To view the Phoenix app in a notebook, run `px.active_session().view()`
📖 For more information on how to use Phoenix, check out https://docs.arize.com/phoenix
<phoenix.session.session.ThreadSession at 0x7d6fb9675f00>
```

The link above opens a window in your browser to view the streaming data.

```python
tracer = OpenInferenceTracer()
chain.run(query, callbacks=[tracer])
```

In the example above a chain is instantiated and the streaming data automatically is collected in the previous running Phoenix view.

## LangChain and LlamaIndex Trace Datasets

Phoenix also support datasets that contain OpenInference trace data. This allows data from a LangChain and LlamaIndex running instance to be saved and reopened at any time.

```python

from phoenix.trace.langchain import OpenInferenceTracer

tracer = OpenInferenceTracer()

# Run the application with the tracer
chain.run(query, callbacks=[tracer])

# When you are ready to analyze the data, you can launch the app with it
ds = TraceDataset.from_spans(tracer.get_spans())
px.launch_app(trace=ds)

# Print the dataframe
ds.dataframe.head()

```

The above shows how to get a handle to the tracer data in a DataFrame.

## Traces and Spans Data Export from LangChain/LlamaIndex

In addition to launching phoenix on LlamaIndex and LangChain, teams can export trace data to a dataframe in order to run Evals on the data.

```python
from phoenix.experimental.evals import run_relevance_eval

#Exports all of the traces from all the current LangChain / LlamaIndex runs
trace_df = px.active_session().get_spans_dataframe('span_kind == "RETRIEVER"')
#RAG relevance eval
run_relevance_eval(trace_df)

```

The above shows how to export only retriever spans into a dataframe from LangChain runs.

## Phoenix Tracing App

Phoenix can be used to troubleshoot traces by pinpointing the timing problems, evaluation performance and points of breakage of specific chains.

<figure><img src="../.gitbook/assets/Screenshot 2023-09-16 at 6.29.46 PM.png" alt=""><figcaption><p>Trace Troubleshooting</p></figcaption></figure>

The above shows trace level troubleshooting of a LangChain/LlamaIndex query on documents.

<figure><img src="../.gitbook/assets/Screenshot 2023-09-16 at 6.29.29 PM.png" alt=""><figcaption><p>Retriever Spans</p></figcaption></figure>

Retriever spans help visualize the chunks returned and the relevancy/performance of that retrieval.

<figure><img src="../.gitbook/assets/Screenshot 2023-09-16 at 6.50.53 PM.png" alt=""><figcaption><p>LLM Span</p></figcaption></figure>

The LLM Spans capture information and attributes of the LLM calls from LangChain and LlamaIndex.

<figure><img src="../.gitbook/assets/Screenshot 2023-09-16 at 6.51.00 PM.png" alt=""><figcaption><p>LLM Parameters</p></figcaption></figure>

LLM Invocation parameters are tracked.

<figure><img src="../.gitbook/assets/Screenshot 2023-09-16 at 6.30.11 PM.png" alt=""><figcaption><p>LLM Span Visualization</p></figcaption></figure>

Phoenix also keeps track of span information for debugging Evals, token usage and latency.

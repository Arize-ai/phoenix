---
description: >-
  Extract OpenInference inferences and traces to visualize and troubleshoot your
  LLM Application in Phoenix
---

# LangChain

Phoenix has first-class support for [LangChain](https://langchain.com/) applications. This means that you can easily extract inferences and traces from your LangChain application and visualize them in Phoenix.

<table data-card-size="large" data-view="cards"><thead><tr><th></th><th></th><th></th><th data-hidden data-card-target data-type="content-ref"></th></tr></thead><tbody><tr><td><strong>Analyze using Tracing</strong></td><td>Trace through the execution of your application hierarchically</td><td></td><td><a href="langchain.md#traces">#traces</a></td></tr><tr><td><strong>Analyze using Inferences</strong></td><td>Perform drift and retrieval analysis via inference DataFrames</td><td></td><td><a href="langchain.md#inferences">#inferences</a></td></tr></tbody></table>

## Traces

Traces provide telemetry data about the execution of your LLM application. They are a great way to understand the internals of your LangChain application and to troubleshoot problems related to things like retrieval and tool execution.

To extract traces from your LangChain application, you will have to add Phoenix's OpenInference Tracer to your LangChain application. A tracer is a class that automatically accumulates traces (sometimes referred to as `spans`) as your application executes. The OpenInference Tracer is a tracer that is specifically designed to work with Phoenix and by default exports the traces to a locally running phoenix server.

To view traces in Phoenix, you will first have to start a Phoenix server. You can do this by running the following:

```python
import phoenix as px
session = px.launch_app()
```

Once you have started a Phoenix server, you can start your LangChain application with the OpenInference Tracer as a callback. To do this, you will have to add the tracer to the initialization of your LangChain application:

```python
from phoenix.trace.langchain import OpenInferenceTracer

# If no exporter is specified, the tracer will export to the locally running Phoenix server
tracer = OpenInferenceTracer()

# Initialize your LangChain application

# Instrument the execution of the runs with the tracer. By default the tracer uses an HTTPExporter
response = chain.run(query, callbacks=[tracer])

```

By adding the tracer to the callbacks of LangChain, we've created a one-way data connection between your LLM application and Phoenix. This is because by default the `OpenInferenceTracer` uses an `HTTPExporter` to send traces to your locally running Phoenix server! In this scenario the Phoenix server is serving as a `Collector` of the spans that are exported from your LangChain application.

To view the traces in Phoenix, simply open the UI in your browser.

```python
px.active_session().view()
```

#### Saving Traces

If you would like to save your traces to a file for later use, you can directly extract the traces from the `tracer`

To directly extract the traces from the `tracer`, dump the traces from the tracer into a file (we recommend `jsonl` for readability).

```python
from phoenix.trace.span_json_encoder import spans_to_jsonl
with open("trace.jsonl", "w") as f:
    f.write(spans_to_jsonl(tracer.get_spans()))
```

Now you can save this file for later inspection. To launch the app with the file generated above, simply pass the contents in the file above via a `TraceDataset`

```python
from phoenix.trace.utils import json_lines_to_df

json_lines = []
with open("trace.jsonl", "r") as f:
        json_lines = cast(List[str], f.readlines())
trace_ds = TraceDataset(json_lines_to_df(json_lines))
px.launch_app(trace=trace_ds)
```

In this way, you can use files as a means to store and communicate interesting traces that you may want to use to share with a team or to use later down the line to fine-tune an LLM or model.

#### Working Example with Traces

For a fully working example of tracing with LangChain, checkout our colab notebook.

{% embed url="https://colab.research.google.com/github/Arize-ai/phoenix/blob/main/tutorials/tracing/langchain_tracing_tutorial.ipynb" %}
Troubleshooting an LLM application using the OpenInferenceTracer
{% endembed %}

## Inferences



Phoenix supports visualizing LLM application inference data from a LangChain application. In particular you can use Phoenix's embeddings projection and clustering to troubleshoot retrieval-augmented generation. For a tutorial on how to extract embeddings and inferences from LangChain, check out the following notebook.

{% embed url="https://colab.research.google.com/github/Arize-ai/phoenix/blob/main/tutorials/langchain_pinecone_search_and_retrieval_tutorial.ipynb" %}
Evaluating and Improving Search and Retrieval Applications (LangChain, Pinecone)
{% endembed %}

---
description: How to connect to OpenInference compliant data via a llama_index callbacks
---

# LlamaIndex

[LlamaIndex](https://github.com/jerryjliu/llama_index) (GPT Index) is a data framework for your LLM application. It's a powerful framework by which you can build an application that leverages RAG (retrieval-augmented generation) to super-charge an LLM with your own data. RAG is an extremely powerful LLM application model because it lets you harness the power of LLMs such as OpenAI's GPT but tuned to your data and use-case.

However when building out a retrieval system, a lot can go wrong that can be detrimental to the user-experience of your question and answer system. Phoenix provides two different ways to gain insights into your LLM application: [OpenInference](../concepts/open-inference.md) inference records and [OpenInference](../concepts/open-inference.md) tracing.\

<table data-card-size="large" data-view="cards"><thead><tr><th></th><th></th><th></th><th data-hidden data-card-target data-type="content-ref"></th></tr></thead><tbody><tr><td><strong>Analyze using Traces</strong><br>Trace through the execution of your application hierarchically</td><td></td><td></td><td><a href="llamaindex.md#traces">#traces</a></td></tr><tr><td><strong>Analyze using Inferences</strong></td><td>Perform drift and retrieval analysis via inference DataFrames</td><td></td><td><a href="llamaindex.md#inferences">#inferences</a></td></tr></tbody></table>

### Traces

Traces provide telemetry data about the execution of your LLM application. They are a great way to understand the internals of your LlamaIndex application and to troubleshoot problems related to things like retrieval and tool execution.

To extract traces from your LlamaIndex application, you will have to add Phoenix's `OpenInferenceTraceCallback` to your LlamaIndex application. A callback (in this case a OpenInference `Tracer`) is a class that automatically accumulates traces (sometimes referred to as `spans`) as your application executes. The OpenInference \`Tracer\`\` is a tracer that is specifically designed to work with Phoenix and by default exports the traces to a locally running phoenix server.

To view traces in Phoenix, you will first have to start a Phoenix server. You can do this by running the following:

```python
import phoenix as px
session = px.launch_app()
```

Once you have started a Phoenix server, you can start your LlamaIndex application with the `OpenInferenceTraceCallback` as a callback. To do this, you will have to add the callback to the initialization of your LlamaIndex application

{% hint style="info" %}
LlamaIndex 0.8.36 and above supports One-Click!
{% endhint %}

{% tabs %}
{% tab title="Using a Callback" %}

```python
from phoenix.trace.llama_index import (
    OpenInferenceTraceCallbackHandler,
)

# Initialize the callback handler
callback_handler = OpenInferenceTraceCallbackHandler()

# LlamaIndex application initialization may vary
# depending on your application
service_context = ServiceContext.from_defaults(
    llm_predictor=LLMPredictor(llm=ChatOpenAI(model_name="gpt-3.5-turbo", temperature=0)),
    embed_model=OpenAIEmbedding(model="text-embedding-ada-002"),
    callback_manager=CallbackManager(handlers=[callback_handler]),
)
index = load_index_from_storage(
    storage_context,
    service_context=service_context,
)
query_engine = index.as_query_engine()

```

{% endtab %}

{% tab title="One-Click" %}

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

{% endtab %}
{% endtabs %}

By adding the callback to the callback manager of LlamaIndex, we've created a one-way data connection between your LLM application and Phoenix. This is because by default the `OpenInferenceTraceCallback` uses an `HTTPExporter` to send traces to your locally running Phoenix server! In this scenario the Phoenix server is serving as a `Collector` of the spans that are exported from your LlamaIndex application.

To view the traces in Phoenix, simply open the UI in your browser.

```python
px.active_session().view()
```

### Saving Traces

If you would like to save your traces to a file for later use, you can directly extract the traces from the callback

To directly extract the traces from the callback, dump the traces from the tracer into a file (we recommend `jsonl` for readability).

```python
from phoenix.trace.span_json_encoder import spans_to_jsonl
with open("trace.jsonl", "w") as f:
    f.write(spans_to_jsonl(callback.get_spans()))
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

For a fully working example of tracing with LlamaIndex, checkout our colab notebook.

{% embed url="https://colab.research.google.com/github/Arize-ai/phoenix/blob/main/tutorials/tracing/llama_index_tracing_tutorial.ipynb" %}
Troubleshooting an LLM application using the OpenInferenceTraceCallback
{% endembed %}

## Inferences

{% hint style="info" %}
Inferences capture each invocation of the LLM application as a single record and is useful for troubleshooting the app's RAG performance using Phoenix's embedding visualization. To view the traces or telemetry information of your application, skip forward to traces.
{% endhint %}

\
To provide visibility into how your LLM app is performing, we built the [OpenInferenceCallback](https://github.com/jerryjliu/llama_index/blob/57d8253c12fcda0061d3167d56dbc425981e131f/docs/examples/callbacks/OpenInferenceCallback.ipynb). The OpenInferenceCallback captures the internals of the LLM App in buffers that conforms to the [OpenInference](../concepts/open-inference.md) format. As your LlamaIndex application, the callback captures the timing, embeddings, documents, and other critical internals and serializes the data to buffers that can be easily materialized as dataframes or as files such as Parquet. Since Phoenix can ingest OpenInference data natively, making it a seamless integration to analyze your LLM powered chatbot. To understand callbacks in details, consult the [LlamaIndex docs.](https://gpt-index.readthedocs.io/en/latest/core_modules/supporting_modules/callbacks/root.html)

### Adding the OpenInferenceCallback

With a few lines of code, you can mount the OpenInferenceCallback to your application\\

```python
from llama_index.callbacks import CallbackManager, OpenInferenceCallbackHandler

callback_handler = OpenInferenceCallbackHandler()
callback_manager = CallbackManager([callback_handler])
service_context = ServiceContext.from_defaults(callback_manager=callback_manager)
```

#### Analyzing the data

If you are running the chatbot in a notebook, you can simply flush the callback buffers to dataframes. Phoenix natively supports parsing OpenInference so there is no need to define a schema for your dataset.

```python
import phoenix as px
from llama_index.callbacks.open_inference_callback import as_dataframe

query_data_buffer = callback_handler.flush_query_data_buffer()
query_dataframe = as_dataframe(query_data_buffer)

# Construct a phoenix dataset directly from the dataframe, no schema needed
dataset = px.Dataset.from_open_inference(query_dataframe)
px.launch_app(dataset)
```

#### Logging data in production

In a production setting, LlamaIndex application maintainers can log the data generated by their system by implementing and passing a custom `callback` to `OpenInferenceCallbackHandler`. The callback is of type `Callable[List[QueryData]]` that accepts a buffer of query data from the `OpenInferenceCallbackHandler`, persists the data (e.g., by uploading to cloud storage or sending to a data ingestion service), and flushes the buffer after data is persisted.\
\
A reference implementation is included below that periodically writes data in OpenInference format to local Parquet files when the buffer exceeds a certain size.

```python
class ParquetCallback:
    def __init__(self, data_path: Union[str, Path], max_buffer_length: int = 1000):
        self._data_path = Path(data_path)
        self._data_path.mkdir(parents=True, exist_ok=False)
        self._max_buffer_length = max_buffer_length
        self._batch_index = 0

    def __call__(self, query_data_buffer: List[QueryData]) -> None:
        if len(query_data_buffer) > self._max_buffer_length:
            query_dataframe = as_dataframe(query_data_buffer)
            file_path = self._data_path / f"log-{self._batch_index}.parquet"
            query_dataframe.to_parquet(file_path)
            self._batch_index += 1
            query_data_buffer.clear()  # ⚠️ clear the buffer or it will keep growing forever!
```

⚠️ In a production setting, it's important to clear the buffer, otherwise, the callback handler will indefinitely accumulate data in memory and eventually cause your system to crash.

{% hint style="info" %}
Note that Parquet is just an example file format, you can use any file format of your choosing such as Avro and NDJSON.
{% endhint %}

For the full guidance on how to materialize your data in files, consult the [LlamaIndex notebook](https://github.com/jerryjliu/llama_index/blob/main/docs/examples/callbacks/OpenInferenceCallback.ipynb).

#### Working Example with Inferences

For a fully working example, checkout our colab notebook.

{% embed url="https://colab.research.google.com/github/Arize-ai/phoenix/blob/main/tutorials/llama_index_search_and_retrieval_tutorial.ipynb" %}
Troubleshooting an LLM application using the OpenInferenceCallback
{% endembed %}

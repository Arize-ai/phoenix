---
description: Tracing the execution of LLM powered applications
---

# LLM Traces

## What is LLM App Tracing and Observability?

The rise of LangChain and LlamaIndex for LLM app development has enabled developers to move quickly in building applications powered by LLMs. The abstractions created by these frameworks can accelerate development, but also make it hard to debug the LLM app.

<figure><img src="../.gitbook/assets/Screenshot 2023-09-09 at 9.16.25 AM.png" alt=""><figcaption><p>LLM App Frameworks</p></figcaption></figure>

LLM Trace observability attempts to make it easier to troubleshoot LangChain and LlamaIndex LLM frameworks.

<figure><img src="../.gitbook/assets/Screenshot 2023-09-09 at 9.15.08 AM.png" alt=""><figcaption><p>LLM Spans</p></figcaption></figure>

The above gives an example of the spans that are part of a single session of a LlamaIndex or LangChain session. In order to capture the span data, tracing should be enabled.

## Enabling Tracing

In order to enable tracing you only need a couple lines of code to your installations:

### LangChain

Enabling Phoenix for LangChain is a couple lines of code where LangChain is instantiated.

```python
from langchain.llms import OpenAI
from langchain.document_loaders import PyPDFLoader
from langchain.chains.question_answering import load_qa_chain
from phoenix.trace.langchain import OpenInferenceTracer, LangChainInstrumentor

### Instrument LangChain ###
tracer = OpenInferenceTracer()
LangChainInstrumentor(tracer).instrument()

loader = PyPDFLoader("./example.pdf")
documents = loader.load()

chain = load_qa_chain(llm=OpenAI(), chain_type="map_reduce")
query = "what is the total number of AI publications?"

### Phoenix tracer used in callback ###
chain.run(input_documents=documents, question=query)

```

{% hint style="info" %}
for a full tutorial on LangChain, see the[ integration guide](langchain-and-llamaindex-traces.md#langchain)
{% endhint %}

### **LlamaIndex**

Enabling LlamaIndex is a couple lines of code where LlamaIndex is instantiated.

```python
import phoenix as px
from phoenix.trace.llama_index import (
    OpenInferenceTraceCallbackHandler,
)

### Phoenix OpenInference Callback ###
callback_handler = OpenInferenceTraceCallbackHandler()
### Phoenix tracer used in the callback ###
service_context = ServiceContext.from_defaults(
    llm_predictor=LLMPredictor(llm=ChatOpenAI(model_name="gpt-3.5-turbo", temperature=0)),
    embed_model=OpenAIEmbedding(model="text-embedding-ada-002"),
    callback_manager=CallbackManager(handlers=[callback_handler]),
)

index = load_index_from_storage(storage_context, service_context=service_context)
query_engine = index.as_query_engine()
```

{% hint style="info" %}
For a full tutorial on LlamaIndex, see the [integration guide](langchain-and-llamaindex-traces.md#llamaindex)
{% endhint %}

## Troubleshooting with Phoenix

Once you enable tracing for LangChain or LlamaIndex with Phoenix, the Phoenix platform will be available locally for troubleshooting.

```python
import phoenix as px
px.launch_app()
```

The launch Phoenix outputs a link to open the application in the browser:

```
>> 🌍 To view the Phoenix app in your browser, visit https://jzmp4hjexd3-496ff2e9c6d22116-6060-colab.googleusercontent.com/
>> 📺 To view the Phoenix app in a notebook, run `px.active_session().view()`
>> 📖 For more information on how to use Phoenix, check out https://docs.arize.com/phoenix
```

<figure><img src="../.gitbook/assets/Screenshot 2023-09-02 at 12.53.45 PM (1).png" alt=""><figcaption><p>Phoenix Traces</p></figcaption></figure>

The above shows the traces for a set of span(runs) including Chain, LLM and Retriever span types.

There are two ways to launch phoenix tracing on spans:

1. Streaming - Stream a live active LangChain or LlamaIndex session into phoenix continuously
2. Span File - Open an OpenInference spans file into Phoenix and extract an OpenInference span file from Phoenix

### Streaming Spans

In many cases teams may want to stream spans from an active instantiation of LangChain/LlamaIndex into a live running Phoenix session. This can occur in a Notebook based environment or production.

```python
import phoenix as px
px.launch_app()
```

The above instantiation is used for streaming. One-click options _coming soon_ for directing spans to specific locations.

### Phoenix with OpenInference Span Files

Phoenix can also be opened on OpenInference span files. These are useful for saving off span information for running Evals and re-importing into Phoenix.

```python
from langchain.chains import RetrievalQA
from phoenix.trace.langchain import OpenInferenceTracer

chain = RetrievalQA.from_chain_type(
    llm=llm,
    chain_type=chain_type,
    retriever=knn_retriever,
)
#### You can use the tracer directly in the callback ####
tracer = OpenInferenceTracer()
chain.run(query, callbacks=[tracer])
#### The tracer dataset can be exported into a dataframe ####
ds = TraceDataset.from_spans(tracer.span_buffer)
#### Launch Phoenix on the dataframe ####
px.launch_app(trace=ds)

```

The example above instantiates the Phoenix tracer directly and then exports the span data into a dataframe. Phoenix is then loaded on that OpenInference span dataframe.

### Exporting Spans to Notebook

In development, you may want to go from a collection of span data in Phoenix that has been streaming into the application, back to a Notebook to run Evals or analysis.

```python

from phoenix.experimental.evals import run_relevance_eval
#In a python environment that is running the active session
trace_df = px.active_session().get_spans_dataframe('span_kind == "RETRIEVER"')
#You can export back to a notebook for running Evals
trace_df["llm_assisted_relevance"] = run_relevance_eval(trace_df)

```

The above example shows how you can export spans out of the current running session, in this case only the span\_kind reriever.

## SpanKind

The the spanKind type of span from LLM Frameworks determine the attributes and functionality supported.

<figure><img src="https://storage.googleapis.com/arize-assets/phoenix/assets/images/Supported%20LLM%20Span%20types.png" alt=""><figcaption><p>The SpanKinds supported by OpenInference Tracing</p></figcaption></figure>

#### _**Chain:**_

Overall chain object for chaining together LLM Spans, can include sub chains. This will typically be the top span call that starts the LLM Framework.

**Agent:**

A object that encompasses calls to LLMs and Tools. An agent describes a reasoning block that acts on tools using the guidance of an LLM.

#### **LLM:**

Used to describe an LLM call and parameters.

#### **Retriever:**

Used for VectorDB retriever LLM calls. It contains the retreived contexts and queries used in the retriever search.

#### **Embedding:**

LLM Embedding calls where there are text to embedding generation steps. Includes the text and embedding generated.

#### **Tool:**

Calls to external tools from an LLM

### Phoenix Traces

Phoenix can be used to troubleshoot traces of execution. With traces you can:

* Identify performance bottlenecks
* Introspect the internals of the different application steps&#x20;
* Evaluate the performance performance of retrieval and generation
* &#x20;Identify critical events and exceptions

<figure><img src="https://storage.googleapis.com/arize-assets/phoenix/assets/images/trace_details_view.png" alt=""><figcaption><p>Introspect the execution of a request trace via spans</p></figcaption></figure>

The above trace shows a retrieval run by LlamaIndex and the Chain/Retriever/Embedding/LLM spans that comprise that trace. The timing can be debugged be sorting the spans or going to a particular LLM span.\


<figure><img src="https://storage.googleapis.com/arize-assets/phoenix/assets/images/trace_listing.png" alt=""><figcaption><p>Traces captured by the streamed output of the tracing callback</p></figcaption></figure>

The above shows a set of traces in Phoenix streamed in from a running session.\


<figure><img src="https://storage.googleapis.com/arize-assets/phoenix/assets/images/trace_span_steps.png" alt=""><figcaption></figcaption></figure>

A set of spans can be decomposed underneath a specific run of a chain. This can be used to track down evaluation or performance problems during a particular step.

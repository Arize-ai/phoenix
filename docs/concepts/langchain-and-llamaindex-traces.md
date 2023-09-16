---
description: Coming Soon!
---

# LangChain & LlamaIndex Traces

## What is Trace Observability?

The rise of LangChain and LlamaIndex for LLM app development has enabled developers to move quickly in building applications powered by LLMs. The abstractions created by these frameworks can accelerate development, but also make it hard to debug the LLM app.

<figure><img src="../.gitbook/assets/Screenshot 2023-09-09 at 9.16.25 AM.png" alt=""><figcaption><p>LLM App Frameworks</p></figcaption></figure>

LLM Trace observability attempts to make it easier to troubleshoot LangChain and LlamaIndex LLM frameworks.

<figure><img src="../.gitbook/assets/Screenshot 2023-09-09 at 9.15.08 AM.png" alt=""><figcaption><p>LLM Spans</p></figcaption></figure>

The above gives an example of the spans that are part of a single session of a LlamaIndex or LangChain session. In order to capture the span data, tracing should be enabled.

## Enabling Tracing

In order to enable tracing you only need a couple lines of code to your installations:

### LangChain

Enabling Phoenix for LangChain is a couple lines of code where LangChain is instantiated.&#x20;

```python
from langchain.llms import OpenAI
from langchain.document_loaders import PyPDFLoader
from langchain.chains.question_answering import load_qa_chain
from phoenix.experimental.callbacks.langchain_tracer import OpenInferenceTracer

loader = PyPDFLoader("./example.pdf")
documents = loader.load()

chain = load_qa_chain(llm=OpenAI(), chain_type="map_reduce")
query = "what is the total number of AI publications?"

### Phoenix Open Inference Tracer ###
tracer = OpenInferenceTracer()
### Phoenix tracer used in callback ###
chain.run(input_documents=documents, question=query, callbacks=[tracer])

```

### **LlamaIndex**

Enabling LlamaIndex is a couple lines of code where LlamaIndex is instantiated.&#x20;

```python
import phoenix as px
from phoenix.experimental.callbacks.llama_index_trace_callback_handler import (
    OpenInferenceTraceCallbackHandler,
)

### Phoenix Open Inference Tracer ###
callback_handler = OpenInferenceTraceCallbackHandler()
### Phoenix tracer used in callback ###
service_context = ServiceContext.from_defaults(
    llm_predictor=LLMPredictor(llm=ChatOpenAI(model_name="gpt-3.5-turbo", temperature=0)),
    embed_model=OpenAIEmbedding(model="text-embedding-ada-002"),
    callback_manager=CallbackManager(handlers=[callback_handler]),
)

index = load_index_from_storage(storage_context, service_context=service_context)
query_engine = index.as_query_engine()
```

## Troubleshooting with Phoenix

Once you enable tracing for LangChain or LlamaIndex with Phoenix, the Phoenix platform will be available locally for troubleshooting.&#x20;

```python
import phoenix as px
px.launch_app()
```

The launch Phoenix outputs a link to open in the browser:

```
>> 🌍 To view the Phoenix app in your browser, visit https://jzmp4hjexd3-496ff2e9c6d22116-6060-colab.googleusercontent.com/
>> 📺 To view the Phoenix app in a notebook, run `px.active_session().view()`
>> 📖 For more information on how to use Phoenix, check out https://docs.arize.com/phoenix
```

Phoenix local interface visualization below:&#x20;

<figure><img src="../.gitbook/assets/Screenshot 2023-09-02 at 12.53.45 PM (1).png" alt=""><figcaption><p>Phoenix Traces</p></figcaption></figure>

The above shows the traces for a set of span(runs) including Chain, LLM and Retriever span types.

There are two ways to launch phoenix tracing on spans:

1. Streaming - Stream a live active LangChain or LlamaIndex session into phoenix continuously&#x20;
2. Span File - Open an OpenInference spans file into Phoenix and extract an OpenInference span file from Phoenix

### Streaming Spans

In many cases teams may want to stream spans from an active instantiation of LangChain/LlamaIndex into a live running Phoenix session. This can occur in a Notebook based environment or production.&#x20;

```python
import phoenix as px
px.launch_app()
```

The above instantiation is used for streaming. One-click options _coming soon_ for directing spans to specific locations.&#x20;

### Phoenix with OpenInference Span Files

Phoenix can also be opened on OpenInference span files. These are useful for saving off span information for running Evals and re-importing into Phoenix.

```python
from langchain.chains import RetrievalQA
from phoenix.experimental.callbacks.langchain_tracer import OpenInferenceTracer

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

The example above instantiates the Phoenix tracer directly and then exports the span data into a dataframe. Phoenix is then loaded on that OpenInference span dataframe.&#x20;

### Exporting Spans to Notebook

In development, you may want to go from a collection of span data in Phoenix that has been streaming into the application, back to a Notebook to run Evals or analysis.&#x20;

```python

from phoenix.experimental.evals import run_relevance_eval
#In a python environment that is running the active session
trace_df = px.active_session().get_spans_dataframe('span_kind == "RETRIEVER"')
#You can export back to a notebook for running Evals
trace_df["llm_assisted_relevance"] = run_relevance_eval(trace_df)

```

The above example shows how you can export spans out of the current running session, in this case only the span_kind reriever.&#x20;

## Span Types

The the span types from LLM Frameworks determine the attributes and functionality supported.

<figure><img src="../.gitbook/assets/Screenshot 2023-09-09 at 9.15.30 AM (2).png" alt=""><figcaption></figcaption></figure>

#### _**Chain:**_

Overall chain object for chaining together LLM Spans, can include sub chains. This will typically be the top span call that starts the LLM Framework.

**Agent:**

A object that encompasses calls to LLMs and Tools. An agent describes a reasoning block that acts on tools using the guidance of an LLM.

#### **LLM:**

Used to describe an LLM call and parameters.&#x20;

#### **Retriever:**

Used for VectorDB retriever LLM calls. It contains the retreived contexts and queries used in the retriever search.&#x20;

#### **Embedding:**

LLM Embedding calls where there are text to embedding generation steps. Includes the text and embedding generated.&#x20;

#### **Tool:**

Calls to external tools from an LLM&#x20;

### Phoenix Traces

Phoenix can be used to troubleshoot traces by pinpointing the timing problems, evaluation performance and points of breakage of specific chains. \

<figure><img src="../.gitbook/assets/Screenshot 2023-09-02 at 3.15.31 PM.png" alt=""><figcaption><p>Trace problems in Spans</p></figcaption></figure>

The above trace shows a retrieval run by LlamaIndex and the Chain/Retriever/Embedding/LLM spans that comprise that trace. The timing can be debugged be sorting the spans or going to a particular LLM span. &#x20;

<figure><img src="../.gitbook/assets/Screenshot 2023-09-09 at 9.55.08 AM.png" alt=""><figcaption><p>Stream Traces</p></figcaption></figure>

The above shows a set of traces in Phoenix streamed in from a running session.\

<figure><img src="../.gitbook/assets/Screenshot 2023-09-09 at 9.55.24 AM.png" alt=""><figcaption><p>Decomposition of Spans</p></figcaption></figure>

A set of spans can be decomposed underneath a specific run of a chain. This can be used to track down evaluation or performance problems at specific chain positions.

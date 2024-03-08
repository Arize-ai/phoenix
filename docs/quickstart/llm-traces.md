---
description: Inspect the inner-workings of your LLM Application using OpenInference Traces
---

# Quickstart: Traces

## Overview

Tracing is a powerful tool for understanding the behavior of your LLM application. Phoenix has best-in-class tracing, irregardless of what framework you use.

To get started with traces, you will first want to start a local Phoenix app.

In your Jupyter or Colab environment, run the following command to install.

{% tabs %}
{% tab title="Using pip" %}
```sh
pip install arize-phoenix[evals]
```
{% endtab %}

{% tab title="Using conda" %}
```sh
conda install -c conda-forge arize-phoenix[evals]
```
{% endtab %}
{% endtabs %}

To get started, launch the phoenix app.

```python
import phoenix as px
session = px.launch_app()
```

The above launches a Phoenix server that acts as a trace collector for any LLM application running locally.

```markup
🌍 To view the Phoenix app in your browser, visit https://z8rwookkcle1-496ff2e9c6d22116-6060-colab.googleusercontent.com/
📺 To view the Phoenix app in a notebook, run `px.active_session().view()`
📖 For more information on how to use Phoenix, check out https://docs.arize.com/phoenix
```

The `launch_app` command will spit out a URL for you to view the Phoenix UI. You can access this url again at any time via the [session](../api/session.md).\
\
Now that phoenix is up and running, you can now run a [LlamaIndex](../tracing/instrumentation/llamaindex.md) or [LangChain](../tracing/instrumentation/langchain.md) application OR just run the OpenAI API and debug your application as the traces stream in.

{% tabs %}
{% tab title="LlamaIndex" %}
If you are using `llama-index>0.8.36` you will be able to instrument your application with LlamaIndex's [one-click](https://gpt-index.readthedocs.io/en/latest/end\_to\_end\_tutorials/one\_click\_observability.html) observability.

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

# Run your LlamaIndex application and traces
# will be collected and displayed in Phoenix.

# LlamaIndex application initialization may vary
# depending on your application. Below is a simple example:
service_context = ServiceContext.from_defaults(
    llm_predictor=LLMPredictor(llm=ChatOpenAI(model_name="gpt-3.5-turbo", temperature=0)),
    embed_model=OpenAIEmbedding(model="text-embedding-ada-002"),
)
index = load_index_from_storage(
    storage_context,
    service_context=service_context,
)
query_engine = index.as_query_engine()

# Execute queries
query_engine.query("What is OpenInference tracing?")
```

See the [integrations guide](../tracing/instrumentation/llamaindex.md#traces) for the full details as well as support for older versions of LlamaIndex
{% endtab %}

{% tab title="LangChain" %}
```python
from phoenix.trace.langchain import LangChainInstrumentor

LangChainInstrumentor().instrument()

# Initialize your LangChain application
# This might vary on your use-case. An example Chain is shown below
from langchain.chains import RetrievalQA
from langchain.chat_models import ChatOpenAI
from langchain.embeddings import OpenAIEmbeddings
from langchain.retrievers import KNNRetriever

embeddings = OpenAIEmbeddings(model="text-embedding-ada-002")

knn_retriever = KNNRetriever(
    index=vectors,
    texts=texts,
    embeddings=OpenAIEmbeddings(),
)

llm = ChatOpenAI(model_name="gpt-3.5-turbo")
chain = RetrievalQA.from_chain_type(
    llm=llm,
    chain_type="map_reduce",
    retriever=knn_retriever,
)

# Execute the chain
response = chain.run("What is OpenInference tracing?")
```

See the [integration guide](../tracing/instrumentation/langchain.md#traces) for details
{% endtab %}

{% tab title="OpenAI API" %}
```python
import os
from openai import OpenAI
from phoenix.trace.openai import OpenAIInstrumentor

# Initialize OpenAI auto-instrumentation
OpenAIInstrumentor().instrument()

# Initialize an OpenAI client
# note you must have the OPENAI_API_KEY environment variable set
client = OpenAI()

# Define a conversation with a user message
conversation = [
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user", "content": "Hello, can you help me with something?"}
]

# Generate a response from the assistant
response = client.chat.completions.create(
    model="gpt-3.5-turbo",
    messages=conversation,
)

# Extract and print the assistant's reply
# The traces will be available in the Phoenix App for the above messsages
assistant_reply = response.choices[0].message.content
```
{% endtab %}

{% tab title="AutoGen" %}
```python
from phoenix.trace.openai.instrumentor import OpenAIInstrumentor
from phoenix.trace.openai import OpenAIInstrumentor

import phoenix as px
px.launch_app()
OpenAIInstrumentor().instrument()
```
{% endtab %}
{% endtabs %}

Once you've executed a sufficient number of queries (or chats) to your application, you can view the details of the UI by refreshing the browser url

<figure><img src="https://storage.googleapis.com/arize-assets/phoenix/assets/images/RAG_trace_details.png" alt=""><figcaption><p>A detailed view of a trace of a RAG application using LlamaIndex</p></figcaption></figure>

## Trace Datasets

Phoenix also support datasets that contain [OpenInference trace](../tracing/instrumentation/open-inference.md) data. This allows data from a LangChain and LlamaIndex running instance explored for analysis offline.

There are two ways to extract trace dataframes. The two ways for LangChain are described below.

{% tabs %}
{% tab title="From the App" %}
<pre class="language-python"><code class="lang-python"><strong># You can export a dataframe from the session
</strong><strong># Note that you can apply a filter if you would like to export only a sub-set of spans
</strong><strong>df = px.Client().get_spans_dataframe('span_kind == "RETRIEVER"')
</strong>
<strong># Re-launch the app using the data
</strong>px.launch_app(trace=px.TraceDataset(df))
</code></pre>
{% endtab %}
{% endtabs %}

{% hint style="info" %}
For full details on how to export trace data, see [the detailed guide](../how-to/export-your-data.md#exporting-traces)
{% endhint %}

## Evaluating Traces

In addition to launching phoenix on LlamaIndex and LangChain, teams can export trace data to a dataframe in order to run LLM Evals on the data.

{% hint style="info" %}
Learn more in the [evals quickstart](evals.md).
{% endhint %}

## Phoenix Tracing App

<figure><img src="https://github.com/Arize-ai/phoenix-assets/raw/main/gifs/langchain_rag_stuff_documents_chain_10mb.gif?raw=true" alt=""><figcaption><p>The Phoenix Tracing UI displaying a RAG application trace</p></figcaption></figure>

Phoenix can be used to understand and troubleshoot your by surfacing:

* **Application latency** - highlighting slow invocations of LLMs, Retrievers, etc.
* **Token Usage** - Displays the breakdown of token usage with LLMs to surface up your most expensive LLM calls
* **Runtime Exceptions** - Critical runtime exceptions such as rate-limiting are captured as exception events.
* **Retrieved Documents** - view all the documents retrieved during a retriever call and the score and order in which they were returned
* **Embeddings** - view the embedding text used for retrieval and the underlying embedding model
* **LLM Parameters** - view the parameters used when calling out to an LLM to debug things like temperature and the system prompts
* **Prompt Templates** - Figure out what prompt template is used during the prompting step and what variables were used.
* **Tool Descriptions -** view the description and function signature of the tools your LLM has been given access to
* **LLM Function Calls** - if using OpenAI or other a model with function calls, you can view the function selection and function messages in the input messages to the LLM.\\

[LLM Traces](../concepts/llm-traces.md) are a powerful way to troubleshoot and understand your application and can be leveraged to [evaluate](../llm-evals/llm-evals.md) the quality of your application. For a full list of notebooks that illustrate this in full-color, please check out the [notebooks section](../notebooks.md).

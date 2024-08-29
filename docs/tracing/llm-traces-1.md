---
description: Inspect the inner-workings of your LLM Application using OpenInference Traces
---

# Quickstart: Tracing

## Overview

Tracing is a powerful tool for understanding the behavior of your LLM application. Phoenix has best-in-class tracing, irregardless of what framework you use and has first-class instrumentation for a variety of frameworks ( [LlamaIndex](integrations-tracing/llamaindex.md), [LangChain](integrations-tracing/langchain.md),[ DSPy](integrations-tracing/dspy.md)),  SDKs ([OpenAI](integrations-tracing/openai.md), [Bedrock](integrations-tracing/bedrock.md), [Mistral](integrations-tracing/mistralai.md), [Vertex](integrations-tracing/vertexai.md)), and Languages (Python, Javascript). You can also [manually instrument](how-to-tracing/manual-instrumentation/) your application using the OpenTelemetry SDK.

To get started with traces, you will first want to start a local Phoenix app. Below we will explore how to use Phoenix in a notebook but you can [deploy phoenix ](../deployment/) once you are ready for a persistent observability platform.

In your Jupyter or Colab environment, run the following command to install.

{% tabs %}
{% tab title="Using pip" %}
```sh
pip install arize-phoenix
```
{% endtab %}

{% tab title="Using conda" %}
```sh
conda install -c conda-forge arize-phoenix
```
{% endtab %}
{% endtabs %}

To get started, launch the phoenix app.

```python
import phoenix as px
session = px.launch_app()
```

The above launches a Phoenix server that acts as a trace collector for any LLM application running locally in your jupyter notebook!

```markup
🌍 To view the Phoenix app in your browser, visit https://z8rwookkcle1-496ff2e9c6d22116-6060-colab.googleusercontent.com/
📺 To view the Phoenix app in a notebook, run `px.active_session().view()`
📖 For more information on how to use Phoenix, check out https://docs.arize.com/phoenix
```

The `launch_app` command will spit out a URL for you to view the Phoenix UI. You can access this url again at any time via the [session](../api/session.md).\
\
Now that phoenix is up and running, you can setup tracing for your AI application so that you can debug your application as the traces stream in.

{% tabs %}
{% tab title="LlamaIndex" %}
To use llama-index's one click, you must install the small integration first:

```bash
pip install 'llama-index>=0.10.44'
```

```python
import phoenix as px
from openinference.instrumentation.llama_index import LlamaIndexInstrumentor
import os
from gcsfs import GCSFileSystem
from llama_index.core import (
    Settings,
    VectorStoreIndex,
    StorageContext,
    set_global_handler,
    load_index_from_storage
)
from llama_index.embeddings.openai import OpenAIEmbedding
from llama_index.llms.openai import OpenAI
import llama_index

# To view traces in Phoenix, you will first have to start a Phoenix server. You can do this by running the following:
session = px.launch_app()

# Initialize LlamaIndex auto-instrumentation
LlamaIndexInstrumentor().instrument()

os.environ["OPENAI_API_KEY"] = "<ENTER_YOUR_OPENAI_API_KEY_HERE>"

# LlamaIndex application initialization may vary
# depending on your application
Settings.llm = OpenAI(model="gpt-4-turbo-preview")
Settings.embed_model = OpenAIEmbedding(model="text-embedding-ada-002")


# Load your data and create an index. Here we've provided an example of our documentation
file_system = GCSFileSystem(project="public-assets-275721")
index_path = "arize-phoenix-assets/datasets/unstructured/llm/llama-index/arize-docs/index/"
storage_context = StorageContext.from_defaults(
    fs=file_system,
    persist_dir=index_path,
)

index = load_index_from_storage(storage_context)

query_engine = index.as_query_engine()

# Query your LlamaIndex application
query_engine.query("What is the meaning of life?")
query_engine.query("How can I deploy Arize?")

# View the traces in the Phoenix UI
px.active_session().url
```

See the [LlamaIndex](integrations-tracing/llamaindex.md) for the full details as well as support for older versions of LlamaIndex
{% endtab %}

{% tab title="LangChain" %}
```bash
pip install langchain langchain-community langchainhub langchain-openai langchain-chroma bs4
```

```python
import phoenix as px
from phoenix.trace.langchain import LangChainInstrumentor

# To view traces in Phoenix, you will first have to start a Phoenix server. You can do this by running the following:
session = px.launch_app()

# Initialize Langchain auto-instrumentation
LangChainInstrumentor().instrument()

# Initialize your LangChain application
# This might vary on your use-case. An example Chain is shown below
import bs4
from langchain import hub
from langchain_community.document_loaders import WebBaseLoader
from langchain_chroma import Chroma
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough
from langchain_openai import OpenAIEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_openai import ChatOpenAI

llm = ChatOpenAI(model="gpt-3.5-turbo-0125")

# Load, chunk and index the contents of the blog.
loader = WebBaseLoader(
    web_paths=("https://lilianweng.github.io/posts/2023-06-23-agent/",),
    bs_kwargs=dict(
        parse_only=bs4.SoupStrainer(
            class_=("post-content", "post-title", "post-header")
        )
    ),
)
docs = loader.load()

text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
splits = text_splitter.split_documents(docs)
vectorstore = Chroma.from_documents(documents=splits, embedding=OpenAIEmbeddings())

# Retrieve and generate using the relevant snippets of the blog.
retriever = vectorstore.as_retriever()
prompt = hub.pull("rlm/rag-prompt")

def format_docs(docs):
    return "\n\n".join(doc.page_content for doc in docs)


rag_chain = (
    {"context": retriever | format_docs, "question": RunnablePassthrough()}
    | prompt
    | llm
    | StrOutputParser()
)

# Execute the chain
response = rag_chain.invoke("What is Task Decomposition?")
```

See the [integration guide](integrations-tracing/langchain.md#traces) for details
{% endtab %}

{% tab title="OpenAI" %}
```bash
pip install openai
```

```python
import phoenix as px
from phoenix.trace.openai import OpenAIInstrumentor

# To view traces in Phoenix, you will first have to start a Phoenix server. You can do this by running the following:
session = px.launch_app()

# Initialize OpenAI auto-instrumentation
OpenAIInstrumentor().instrument()

import os
from openai import OpenAI

# Initialize an OpenAI client
client = OpenAI(api_key='')

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
{% endtabs %}

Once you've executed a sufficient number of queries (or chats) to your application, you can view the details of the UI by refreshing the browser url

<figure><img src="https://storage.googleapis.com/arize-assets/phoenix/assets/images/RAG_trace_details.png" alt=""><figcaption><p>A detailed view of a trace of a RAG application using LlamaIndex</p></figcaption></figure>

## Exporting Traces from Phoenix

{% tabs %}
{% tab title="From the App" %}
<pre class="language-python"><code class="lang-python"><strong># You can export a dataframe from the session
</strong>df = px.Client().get_spans_dataframe()
<strong>
</strong><strong># Note that you can apply a filter if you would like to export only a sub-set of spans
</strong><strong>df = px.Client().get_spans_dataframe('span_kind == "RETRIEVER"')
</strong></code></pre>
{% endtab %}
{% endtabs %}

{% hint style="info" %}
For full details on how to export trace data, see [the detailed guide](../how-to/export-your-data.md#exporting-traces)
{% endhint %}

## Evaluating Traces

In addition to launching phoenix on LlamaIndex and LangChain, teams can export trace data to a dataframe in order to run LLM Evals on the data.

{% hint style="info" %}
Learn more in the [evals quickstart](../quickstart/evals.md).
{% endhint %}

## Conclusion

[LLM Traces](../concepts/llm-traces.md) are a powerful way to troubleshoot and understand your application and can be leveraged to [evaluate](../llm-evals/llm-evals.md) the quality of your application (see also: this [deep dive on LLM evaluation](https://arize.com/blog-course/llm-evaluation-the-definitive-guide/)). For a full list of notebooks that illustrate this in full-color, please check out the [notebooks section](../notebooks.md).

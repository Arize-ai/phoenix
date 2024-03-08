---
description: Tracing the execution of LLM powered applications using OpenInference Traces
---

# Overview: Traces

## What is LLM Traces and Observability?

The rise of LangChain and LlamaIndex for LLM app development has enabled developers to move quickly in building applications powered by LLMs. The abstractions created by these frameworks can accelerate development, but also make it hard to debug the LLM app. Take the below example where a RAG application be written in a few lines of code but in reality has a very complex run tree.

<figure><img src="../.gitbook/assets/image (23).png" alt=""><figcaption></figcaption></figure>

LLM Traces and Observability lets us understand the system from the outside, by letting us ask questions about that system without knowing its inner workings. Furthermore, it allows us to easily troubleshoot and handle novel problems (i.e. “unknown unknowns”), and helps us answer the question, “Why is this happening?”

In order to be able to ask those questions of a system, the application must be properly instrumented. That is, the application code must emit signals such as [traces](llm-traces.md#user-content-traces) and logs. An application is properly instrumented when developers don’t need to add more instrumentation to troubleshoot an issue, because they have all of the information they need.

Phoenix's tracing module is the mechanism by which application code is instrumented, to help make a system observable.

<figure><img src="../.gitbook/assets/image (22).png" alt=""><figcaption></figcaption></figure>

LLM Traces and the accompanying[ OpenInference Tracing specification](https://github.com/Arize-ai/open-inference-spec/tree/main/trace/spec) is designed to be a category of telemetry data that is used to understand the execution of LLMs and the surrounding application context such as retrieval from vector stores and the usage of external tools such as search engines or APIs. It lets you understand the inner workings of the individual steps your application takes wile also giving you visibility into how your system is running and performing as a whole.

Let's dive into the fundamental building block of traces: the span.

## Spans <a href="#user-content-spans" id="user-content-spans"></a>

A span represents a unit of work or operation (think a `span` of time). It tracks specific operations that a request makes, painting a picture of what happened during the time in which that operation was executed.

A span contains name, time-related data, structured log messages, and other metadata (that is, Attributes) to provide information about the operation it tracks. A span for an LLM execution in JSON format is displayed below

```json
{
    "name": "llm",
    "context": {
        "trace_id": "ed7b336d-e71a-46f0-a334-5f2e87cb6cfc",
        "span_id": "ad67332a-38bd-428e-9f62-538ba2fa90d4"
    },
    "span_kind": "LLM",
    "parent_id": "f89ebb7c-10f6-4bf8-8a74-57324d2556ef",
    "start_time": "2023-09-07T12:54:47.597121-06:00",
    "end_time": "2023-09-07T12:54:49.321811-06:00",
    "status_code": "OK",
    "status_message": "",
    "attributes": {
        "llm.input_messages": [
            {
                "message.role": "system",
                "message.content": "You are an expert Q&A system that is trusted around the world.\nAlways answer the query using the provided context information, and not prior knowledge.\nSome rules to follow:\n1. Never directly reference the given context in your answer.\n2. Avoid statements like 'Based on the context, ...' or 'The context information ...' or anything along those lines."
            },
            {
                "message.role": "user",
                "message.content": "Hello?"
            }
        ],
        "output.value": "assistant: Yes I am here",
        "output.mime_type": "text/plain"
    },
    "events": [],
}
```

Spans can be nested, as is implied by the presence of a parent span ID: child spans represent sub-operations. This allows spans to more accurately capture the work done in an application.

## Traces <a href="#user-content-traces" id="user-content-traces"></a>

A trace records the paths taken by requests (made by an application or end-user) as they propagate through multiple steps.

Without tracing, it is challenging to pinpoint the cause of performance problems in a system.

It improves the visibility of our application or system’s health and lets us debug behavior that is difficult to reproduce locally. Tracing is essential for LLM applications, which commonly have nondeterministic problems or are too complicated to reproduce locally.

Tracing makes debugging and understanding LLM applications less daunting by breaking down what happens within a request as it flows through a system.

A trace is made of one or more spans. The first span represents the root span. Each root span represents a request from start to finish. The spans underneath the parent provide a more in-depth context of what occurs during a request (or what steps make up a request).

## Span Kind

When a span is created,  it is created as one of the following: Chain, Retriever, Reranker, LLM, Embedding, Agent, or Tool.&#x20;

<figure><img src="https://storage.googleapis.com/arize-assets/phoenix/assets/images/span_kinds.png" alt=""><figcaption><p>The SpanKinds supported by OpenInference Tracing</p></figcaption></figure>

**CHAIN**

A Chain is a starting point or a link between different LLM application steps. For example, a Chain span could be used to represent the beginning of a request to an LLM application or the glue code that passes context from a retriever to and LLM call.

**RETRIEVER**

A Retriever is a span that represents a data retrieval step. For example, a Retriever span could be used to represent a call to a vector store or a database.

**RERANKER**

A Reranker is a span that represents the reranking of a set of input documents. For example, a cross-encoder may be used to compute the input documents' relevance scores with respect to a user query, and the top K documents with the highest scores are then returned by the Reranker.

**LLM**

An LLM is a span that represents a call to an LLM. For example, an LLM span could be used to represent a call to OpenAI or Llama.

**EMBEDDING**

An Embedding is a span that represents a call to an LLM for an embedding. For example, an Embedding span could be used to represent a call OpenAI to get an ada-2 embedding for retrieval.

**TOOL**

A Tool is a span that represents a call to an external tool such as a calculator or a weather API.

**AGENT**

A span that encompasses calls to LLMs and Tools. An agent describes a reasoning block that acts on tools using the guidance of an LLM.\


### Attributes

Attributes are key-value pairs that contain metadata that you can use to annotate a span to carry information about the operation it is tracking.

For example, if a span invokes an LLM, you can capture the model name, the invocation parameters, the token count, and so on.

Attributes have the following rules:

* Keys must be non-null string values
* Values must be a non-null string, boolean, floating point value, integer, or an array of these values Additionally, there are Semantic Attributes, which are known naming conventions for metadata that is typically present in common operations. It's helpful to use semantic attribute naming wherever possible so that common kinds of metadata are standardized across systems. See [semantic conventions](https://github.com/Arize-ai/open-inference-spec/blob/main/trace/spec/semantic\_conventions.md) for more information.\


{% hint style="info" %}
Want to learn more about OpenInference Tracing? It is an open-source specification that is continuously is being evolved. Check out the details at [https://github.com/Arize-ai/open-inference-spec/tree/main/trace/spec](https://github.com/Arize-ai/open-inference-spec/tree/main/trace/spec)
{% endhint %}

\

---
description: A deep dive into the details of a trace
---

# What are Traces?

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



## Projects

A `project` is a collection of traces. You can think of a project as a container for all the traces that are related to a single application or service. You can have multiple projects, and each project can have multiple traces. Projects can be useful for various use-cases such as separating out environments, logging traces for evaluation runs, etc. To learn more about how to setup projects,  see the [how-to guide.](../how-to-tracing/customize-traces.md#log-to-a-specific-project)

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


## Span Attributes

Attributes are key-value pairs that contain metadata that you can use to annotate a span to carry information about the operation it is tracking.

For example, if a span invokes an LLM, you can capture the model name, the invocation parameters, the token count, and so on.

Attributes have the following rules:

* Keys must be non-null string values
* Values must be a non-null string, boolean, floating point value, integer, or an array of these values Additionally, there are Semantic Attributes, which are known naming conventions for metadata that is typically present in common operations. It's helpful to use semantic attribute naming wherever possible so that common kinds of metadata are standardized across systems. See [semantic conventions](https://github.com/Arize-ai/openinference/blob/main/spec/semantic\_conventions.md) for more information.

##

\

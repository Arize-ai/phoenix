---
description: Tracing the execution of LLM powered applications
---

# LLM Traces

## What is LLM App Tracing and Observability?

The rise of LangChain and LlamaIndex for LLM app development has enabled developers to move quickly in building applications powered by LLMs. The abstractions created by these frameworks can accelerate development, but also make it hard to debug the LLM app.

<figure><img src="../.gitbook/assets/image (23).png" alt=""><figcaption></figcaption></figure>

LLM Trace observability attempts to make it easier to troubleshoot LangChain and LlamaIndex LLM frameworks.

<figure><img src="../.gitbook/assets/image (22).png" alt=""><figcaption></figcaption></figure>

The above gives an example of the spans that are part of a single session of a LlamaIndex or LangChain session. In order to capture the span data, tracing should be enabled.

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


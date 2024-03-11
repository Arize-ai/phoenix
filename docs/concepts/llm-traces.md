---
description: Tracing the execution of LLM applications using Telemetry
---

# Overview: Tracing

## What are LLM Traces?

The rise of LangChain and LlamaIndex for LLM app development has enabled developers to move quickly in building applications powered by LLMs. The abstractions created by these frameworks can accelerate development, but also make it hard to debug the LLM app. Take the below example where a RAG application be written in a few lines of code but in reality has a very complex run tree.

<figure><img src="../.gitbook/assets/image (23).png" alt=""><figcaption></figcaption></figure>

LLM Traces and Observability lets us understand the system from the outside, by letting us ask questions about that system without knowing its inner workings. Furthermore, it allows us to easily troubleshoot and handle novel problems (i.e. “unknown unknowns”), and helps us answer the question, “Why is this happening?”

In order to be able to ask those questions of a system, the application must be properly instrumented. That is, the application code must emit signals such as [traces](llm-traces.md#user-content-traces) and logs. An application is properly instrumented when developers don’t need to add more instrumentation to troubleshoot an issue, because they have all of the information they need.

Phoenix's tracing module is the mechanism by which application code is instrumented, to help make a system observable.

<figure><img src="../.gitbook/assets/image (22).png" alt=""><figcaption></figcaption></figure>

LLM Traces and the accompanying[ OpenInference Tracing specification](https://github.com/Arize-ai/open-inference-spec/tree/main/trace/spec) is designed to be a category of telemetry data that is used to understand the execution of LLMs and the surrounding application context such as retrieval from vector stores and the usage of external tools such as search engines or APIs. It lets you understand the inner workings of the individual steps your application takes wile also giving you visibility into how your system is running and performing as a whole.

\

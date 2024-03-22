---
description: Tracing the execution of LLM applications using Telemetry
---

# Overview: Tracing

Tracing is a powerful tool for understanding how your LLM application works. Phoenix has best-class tracing capabilities and is not tied to any LLM vendor or framework.

Tracing can help you track down issues like:

* **Application latency** - highlighting slow invocations of LLMs, Retrievers, etc.
* **Token Usage** - Displays the breakdown of token usage with LLMs to surface up your most expensive LLM calls
* **Runtime Exceptions** - Critical runtime exceptions such as rate-limiting are captured as exception events.
* **Retrieved Documents** - view all the documents retrieved during a retriever call and the score and order in which they were returned
* **Embeddings** - view the embedding text used for retrieval and the underlying embedding model
* **LLM Parameters** - view the parameters used when calling out to an LLM to debug things like temperature and the system prompts
* **Prompt Templates** - Figure out what prompt template is used during the prompting step and what variables were used.
* **Tool Descriptions -** view the description and function signature of the tools your LLM has been given access to
* **LLM Function Calls** - if using OpenAI or other a model with function calls, you can view the function selection and function messages in the input messages to the LLM.

<figure><img src="https://storage.googleapis.com/arize-assets/phoenix/assets/images/trace_details.png" alt=""><figcaption><p>View the inner workings for your LLM Application</p></figcaption></figure>

To get started, check out the [Quickstart guide](../quickstart/llm-traces.md)

After that, read through the [Concepts Section](../tracing/concepts-tracing.md) to get and understanding of the different components.

If you want to learn how to accomplish a particular task, check out the [How-To Guides.](../tracing/how-to-tracing/)

\

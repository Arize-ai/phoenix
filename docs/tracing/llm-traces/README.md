---
description: Tracing the execution of LLM applications using Telemetry
---

# Overview: Tracing

Phoenix's open-source library supports tracing for AI applications, via manual instrumentation or through integrations with LlamaIndex, Langchain, OpenAI, and others.

LLM tracing records the paths taken by requests as they propagate through multiple steps or components of an LLM application. For example, when a user interacts with an LLM application, tracing can capture the sequence of operations, such as document retrieval, embedding generation, language model invocation, and response generation to provide a detailed timeline of the request's execution.

Tracing is a helpful tool for understanding how your LLM application works. Phoenix offers comprehensive tracing capabilities that are not tied to any specific LLM vendor or framework. Phoenix accepts traces over the OpenTelemetry protocol (OTLP) and supports first-class instrumentation for a variety of frameworks ( [LlamaIndex](../integrations-tracing/llamaindex.md), [LangChain](../integrations-tracing/langchain.md),[ DSPy](../integrations-tracing/dspy.md)), SDKs ([OpenAI](../integrations-tracing/openai.md), [Bedrock](../integrations-tracing/bedrock.md), [Mistral](../integrations-tracing/mistralai.md), [Vertex](../integrations-tracing/vertexai.md)), and Languages. (Python, Javascript, etc.)

<figure><img src="https://storage.googleapis.com/arize-phoenix-assets/assets/images/phoenix_tracing.png" alt=""><figcaption><p>View the inner workings for your LLM Application</p></figcaption></figure>

Using Phoenix's tracing capabilities can provide important insights into the inner workings of your LLM application. By analyzing the collected trace data, you can identify and address various performance and operational issues and improve the overall reliability and efficiency of your system.

* **Application Latency**: Identify and address slow invocations of LLMs, Retrievers, and other components within your application, enabling you to optimize performance and responsiveness.
* **Token Usage**: Gain a detailed breakdown of token usage for your LLM calls, allowing you to identify and optimize the most expensive LLM invocations.
* **Runtime Exceptions**: Capture and inspect critical runtime exceptions, such as rate-limiting events, that can help you proactively address and mitigate potential issues.
* **Retrieved Documents**: Inspect the documents retrieved during a Retriever call, including the score and order in which they were returned to provide insight into the retrieval process.
* **Embeddings**: Examine the embedding text used for retrieval and the underlying embedding model to allow you to validate and refine your embedding strategies.
* **LLM Parameters**: Inspect the parameters used when calling an LLM, such as temperature and system prompts, to ensure optimal configuration and debugging.
* **Prompt Templates**: Understand the prompt templates used during the prompting step and the variables that were applied, allowing you to fine-tune and improve your prompting strategies.
* **Tool Descriptions**: View the descriptions and function signatures of the tools your LLM has been given access to in order to better understand and control your LLM’s capabilities.
* **LLM Function Calls**: For LLMs with function call capabilities (e.g., OpenAI), you can inspect the function selection and function messages in the input to the LLM, further improving your ability to debug and optimize your application.

By using tracing in Phoenix, you can gain increased visibility into your LLM application, empowering you to identify and address performance bottlenecks, optimize resource utilization, and ensure the overall reliability and effectiveness of your system.

## Next steps

To get started, check out the [Quickstart guide](../llm-traces-1.md).

Read more about [what traces are](what-are-traces.md) and [how traces work](how-does-tracing-work.md)[.](./#how-does-tracing-work)

Check out the [How-To Guides](../how-to-tracing/) for specific tutorials.

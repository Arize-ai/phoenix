# Overview: Evals

{% embed url="https://storage.googleapis.com/arize-phoenix-assets/assets/images/PX%20docs%20graphic.jpg" %}

The standard for evaluating text is human labeling. However, high-quality LLM outputs are becoming cheaper and faster to produce, and human evaluation cannot scale. In this context, evaluating the performance of LLM applications is best tackled by using a LLM. The Phoenix Evals library is designed for simple, fast, and accurate [LLM-based evaluations](https://arize.com/llm-evaluation/).

## Features

Phoenix Evals provides **lightweight, composable building blocks** for writing and running evaluations on LLM applications. It can be installed completely independently of the `arize-phoenix` package and is available in both **Python** and **TypeScript** versions.

* **Works with your preferred model SDKs** via SDK adapters (OpenAI, LiteLLM, LangChain, AI SDK) - Phoenix lets you configure which foundation model you'd like to use as a judge. This includes OpenAI, Anthropic, Gemini, and much more. See [Configuring the LLM](../how-to-evals/configuring-the-llm/).
* **Powerful input mapping and binding** for working with complex data structures - easily map nested data and complex inputs to evaluator requirements.
* **Several pre-built metrics** for common evaluation tasks like hallucination detection - Phoenix provides pre-tested eval templates for common tasks such as RAG and function calling. Learn more about pretested templates [here](../running-pre-tested-evals/). Each eval is pre-tested on a variety of eval models. Find the most up-to-date benchmarks on [GitHub](https://github.com/Arize-ai/phoenix/tree/main/tutorials/evals).
* **Evaluators are natively instrumented** via OpenTelemetry tracing for observability and dataset curation. See [evaluator-traces.md](evaluator-traces.md "mention") for an overview.
* **Blazing fast performance** - achieve up to 20x speedup with built-in concurrency and batching. Evals run in batches and typically run much faster than calling the APIs directly. See [executors.md](executors.md "mention") for details on how this works.
* **Tons of convenience features** to improve the developer experience!
* **Run evals on your own data** - comes with native dataframe and data transformation utilities, making it easy to run evaluations on your own data—whether that's logs, traces, or datasets downloaded for benchmarking.
* **Built-in Explanations** - All Phoenix evaluations include an explanation capability that requires eval models to explain their judgment rationale. This boosts performance and helps you understand and improve your eval.

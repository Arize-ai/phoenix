# Overview: Evals

{% embed url="https://storage.googleapis.com/arize-phoenix-assets/assets/images/PX%20docs%20graphic.jpg" %}

The standard for evaluating text is human labeling. However, high-quality LLM outputs are becoming cheaper and faster to produce, and human evaluation cannot scale. In this context, evaluating the performance of LLM applications is best tackled by using a LLM. The Phoenix [LLM Evals library](../how-to-evals/running-pre-tested-evals/) is designed for simple, fast, and accurate [LLM-based evaluations](https://arize.com/llm-evaluation/).

Phoenix Evals come with:

* **Pre-built evals** - Phoenix provides pre-tested eval templates for common tasks such as RAG and function calling. Learn more about pretested templates [here](../how-to-evals/running-pre-tested-evals/). Each eval is pre-tested on a variety of eval models. Find the most up-to-date template on [GitHub](https://github.com/Arize-ai/phoenix/tree/main/tutorials/evals).
* **Run evals on your own data** - [Phoenix Evals](../how-to-evals/bring-your-own-evaluator.md) takes a dataframe as its primary input and output, making it easy to run evaluations on your own data - whether that's logs, traces, or datasets downloaded for benchmarking.
* **Speed** - Phoenix evals are designed for maximum speed and throughput. Evals run in batches and typically run 10x faster than calling the APIs directly.
* **Built-in Explanations -** All Phoenix evaluations include an [explanation flag](broken-reference) that requires eval models to explain their judgment rationale. This boosts performance and helps you understand and improve your eval.
* [**Eval Models**](../how-to-evals/evaluation-models.md) - Phoenix let's you configure which foundation model you'd like to use as a judge. This includes OpenAI, Anthropic, Gemini, and much more. See [evaluation-models.md](../how-to-evals/evaluation-models.md "mention")


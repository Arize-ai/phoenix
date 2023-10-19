---
description: >-
  LLM observability is complete visibility into every layer of an LLM-based
  software system: the application, the prompt, and the response.
---

# What is LLM Observability?

## 5 Pillars of LLM Observability

* [**Evaluation**](llm-observability.md#1.-llm-evals) - This helps you evaluate how well the response answers the prompt by using a separate evaluation LLM.
* [**LLM Traces & Spans**](llm-observability.md#2.-traces-and-spans) - This gives you visibility into where more complex or agentic workflows broke.
* [**Prompt Engineering**](llm-observability.md#3.-prompt-engineering) - Iterating on a prompt template can help improve LLM results.
* [**Search and Retrieval**](llm-observability.md#4.-search-and-retrieval) - Improving the context that goes into the prompt can lead to better LLM responses.
* [**Fine-tuning**](llm-observability.md#5.-fine-tuning) - Fine-tuning generates a new model that is more aligned with your exact usage conditions for improved performance.

<figure><img src="../.gitbook/assets/image (14).png" alt=""><figcaption></figcaption></figure>

### 1. LLM Evals

<figure><img src="../.gitbook/assets/image (15).png" alt=""><figcaption></figcaption></figure>

Evaluation is a measure of how well the response answers the prompt.

There are several ways to evaluate LLMs:

1. You can collect the feedback directly from your users. This is the simplest way but can often suffer from users not being willing to provide feedback or simply forgetting to do so. Other challenges arise from implementing this at scale.
2. The other approach is to use an LLM to evaluate the quality of the response for a particular prompt. This is more scalable and very useful but comes with typical LLM setbacks.

Learn more about [Phoenix LLM Evals](../llm-evals/llm-evals.md) library.

### 2. LLM Traces and Spans

<figure><img src="../.gitbook/assets/image (20).png" alt=""><figcaption></figcaption></figure>

For more complex or agentic workflows, it may not be obvious which call in a span or which span in your trace (a run through your entire use case) is causing the problem. You may need to repeat the evaluation process on several spans before you narrow down the problem.

This pillar is largely about diving deep into the system to isolate the issue you are investigating.

Learn more about [Phoenix Traces and Spans](llm-traces.md) support.

### 3. Prompt Engineering

Prompt engineering is the cheapest, fastest, and often the highest-leverage way to improve the performance of your application. Often, LLM performance can be improved simply by comparing different prompt templates, or iterating on the one you have. Prompt analysis is an important component in troubleshooting your LLM's performance.

Learn about [prompt engineering](https://docs.arize.com/arize/llm-large-language-models/prompt-engineering) in Arize.

### 4. Search and Retrieval

<figure><img src="../.gitbook/assets/image (10).png" alt=""><figcaption></figcaption></figure>

A common way to improve performance is with more relevant information being fed in.

If you can retrieve more relevant information, your prompt improves automatically. Troubleshooting retrieval systems, however, is more complex. Are there queries that don’t have sufficient context? Should you add more context for these queries to get better answers? Or should you change your embeddings or chunking strategy?

Learn more about [troubleshooting search and retrieval](../use-cases/troubleshooting-llm-retrieval-with-vector-stores.md) with Phoenix.

### 5. Fine Tuning

Fine tuning essentially generates a new model that is more aligned with your exact usage conditions. Fine tuning is expensive, difficult, and may need to be done again as the underlying LLM or other conditions of your system change. This is a very powerful technique, requires much higher effort and complexity.

<figure><img src="https://lh3.googleusercontent.com/_GnuXCWLToFRH6HnlaDLQUg8mLYE-A7MxlDaGlRwi8FXwJDh44TCiJlqXYgHRAqlwBbmCcbFWbnfIKLOnccFDuA1bloVp8dFgvFARzzZWUpGNsZxxtlfneEV34JseZgzaY8RP2PJhVFYZaUCbSjyCAU" alt=""><figcaption></figcaption></figure>

\\

\\

\
\\

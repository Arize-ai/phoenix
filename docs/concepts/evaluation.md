---
description: >-
  Evaluation and benchmarking are crucial concepts in LLM development. To
  improve the performance of an LLM app (RAG, agents), you must have a way to
  measure it.
---

# Evaluation

Phoenix offers key modules to measure the quality of generated results as well as modules to measure retrieval quality.

* [**Response Evaluation**](evaluation.md#response-evaluation): Does the response match the retrieved context? Does it also match the query?&#x20;
* [**Retrieval Evaluation**](evaluation.md#retrieval-evaluation): Are the retrieved sources relevant to the query?

### Response Evaluation

Evaluation of generated results can be challenging. Unlike traditional ML, the predicted results are not numeric or categorical, making it hard to define quantitative metrics for this problem.

Phoenix offers [LLM Evaluations](broken-reference), a module designed to measure the quality of results. This module uses a "gold" LLM (e.g. GPT-4) to decide whether the generated answer is correct in a variety of ways.\
\
Note that many of these evaluation criteria DO NOT require ground-truth labels. Evaluation can be done simply with a combination of the **input** (query), **output** (response), and **context**.

LLM Evals supports the following response evaluation criteria:

* [**QA Correctness**](../llm-evals/running-pre-tested-evals/q-and-a-on-retrieved-data.md) - Whether a question was correctly answered by the system based on the retrieved data. In contrast to retrieval Evals that are checks on chunks of data returned, this check is a system level check of a correct Q\&A.
* [**Hallucinations**](../llm-evals/running-pre-tested-evals/hallucinations.md) **-** Designed to detect LLM hallucinations relative to private or retrieved context
* [**Toxicity**](../llm-evals/running-pre-tested-evals/toxicity.md) -  Identify if the AI response is racist, biased, or toxic

Response evaluations are a critical first step to figuring out whether your LLM App is running correctly.  Response evaluations can pinpoint specific executions (a.k.a. traces) that are performing badly and can be aggregated up so that you can track how your application is running as a whole.

<figure><img src="https://github.com/Arize-ai/phoenix-assets/blob/main/images/screenshots/eval_aggregations.png?raw=true" alt=""><figcaption><p>Evaluations can be aggregated across executions to be used as KPIs</p></figcaption></figure>

### Retrieval Evaluation

Phoenix also provides evaluation of retrieval independently.

The concept of retrieval evaluation is not new; given a set of relevance scores for a set of retrieved documents, we can evaluate retrievers using retrieval metrics like `precision`, `NDCG`,  `hit rate` and more.

LLM Evals supports the following retrieval evaluation criteria:

* [**Relevance**](../llm-evals/running-pre-tested-evals/retrieval-rag-relevance.md) - Evaluates whether a retrieved document chunk contains an answer to the query. It's extremely useful for evaluating retrieval systems.

<figure><img src="https://github.com/Arize-ai/phoenix-assets/blob/main/images/blog/revlevance_eval_process.png?raw=true" alt=""><figcaption><p>Retrieval Evaluations can be run directly on application traces</p></figcaption></figure>

Retrieval is possibly the most important step in any LLM application as poor and/or incorrect retrieval can be the cause of bad response generation. If your application uses RAG to power an LLM, retrieval evals can help you identify the cause of hallucinations and incorrect answers.

### Evaluations

<figure><img src="https://github.com/Arize-ai/phoenix-assets/blob/main/images/blog/Evaluations.png?raw=true" alt=""><figcaption><p>Datasets that contain generative records can be fed into evals to produce evaluations for analysis</p></figcaption></figure>

With Phoenix's LLM Evals, evaluation results (or just **Evaluations** for short) is a dataset consisting of 3 main columns:&#x20;

* **label**: str \[optional] - a classification label for the evaluation (e.g. "hallucinated" vs "factual"). Can be used to calculate percentages (e.g. percent hallucinated) and can be used to filter down your data (e.g. `Evals["Hallucinations"].label == "hallucinated"`)
* **score**: number \[optional] - a numeric score for the evaluation (e.g. 1 for good, 0 for bad). Scores are great way to sort your data to surface poorly performing examples and can be used to filter your data by a threshold.
* **explanation**: str \[optional] - the reasoning for why the evaluation label or score was given. In the case of LLM evals, this is the evaluation model's reasoning. While explanations are optional, they can be extremely useful when trying to understand problematic areas of your application.

Let's take a look at an example list of **Q\&A relevance** evaluations:

| label     | explanation                                       | score |
| --------- | ------------------------------------------------- | ----- |
| correct   | The reference text explains that YC was not or... | 1     |
| correct   | To determine if the answer is correct, we need... | 1     |
| incorrect | To determine if the answer is correct, we must... | 0     |
| correct   | To determine if the answer is correct, we need... | 1     |

These three columns combined can drive any type of evaluation you can imagine. **label** provides a way to classify responses, **score** provides a way to assign a numeric assessment, and **explanation** gives you a way to get qualitative feedback.

### Evaluating Traces

<figure><img src="https://github.com/Arize-ai/phoenix-assets/blob/main/images/blog/evaluations_on_traces.png?raw=true" alt=""><figcaption><p>Adding evaluations on traces can highlight problematic areas that require further analysis</p></figcaption></figure>

With Phoenix, evaluations can be "attached" to the **spans** and **documents** collected. In order to facilitate this, Phoenix supports the following steps.

1. **Querying and downloading data** - query the spans collected by phoenix and materialize them into DataFrames to be used for evaluation (e.g. question and answer data, documents data).
2. **Running Evaluations** - the data queried in step 1 can be fed into LLM Evals to produce evaluation results.
3. **Logging Evaluations** - the evaluations performed in the above step can be logged back to Phoenix to be attached to spans and documents for evaluating responses and retrieval.
4. **Filtering by Evaluation** - once the evaluations have been logged back to Phoenix, the spans become instantly filterable by the evaluation values that you attached to the spans.

<figure><img src="https://github.com/Arize-ai/phoenix-assets/blob/main/images/blog/evaluation_flow.png?raw=true" alt=""><figcaption><p>End-to-end evaluation flow</p></figcaption></figure>

By following the above steps, you will have a full end-to-end flow to troubleshooting and evaluating and LLM application. For a full tutorial on LLM Ops, check out our tutorial below.

{% embed url="https://colab.research.google.com/github/Arize-ai/phoenix/blob/main/tutorials/llm_ops_overview.ipynb" %}

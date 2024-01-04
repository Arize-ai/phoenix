---
description: >-
  Evaluation and benchmarking are crucial concepts in LLM development. To
  improve the performance of an LLM app (RAG, agents), you must have a way to
  measure it.
---

# Evaluation

Phoenix offers key modules to measure the quality of generated results as well as modulues to measure retrieval quality.

* [**Response Evaluation**](evaluation.md#response-evaluation): Does the response match the retrieved context? Does it also match the query?&#x20;
* [**Retrieval Evaluation**](evaluation.md#retrieval-evaluation): Are the retrieved sources relevant to the query?

### Response Evaluation

Evaluation of generated results can be challenging. Unlike traditional ML, the predicted result s are not numeric or categorical, making it hard to define quantitative metrics for this problem.

Phoenix offers [LLM Evaluations](broken-reference), a module designed to measure the quality of results. This module uses a "gold" LLM (e.x. GPT-4) to decide whether the generated answer is correct in a variety of ways.\
\
Note that many of these evaluation criteria DO NOT require ground-truth labels. Evaluation can be done simply with a combination of the **input** (query), **output** (response), and **context**.

LLM Evals supports the following response evaluation criteria:

* [**QA Correctness**](../llm-evals/running-pre-tested-evals/q-and-a-on-retrieved-data.md) - Whether a question was correctly answered by the system based on the retrieved data. In contrast to retrieval Evals that are checks on chunks of data returned, this check is a system level check of a correct Q\&A.
* [**Hallucinations**](../llm-evals/running-pre-tested-evals/hallucinations.md) **-** Designed to detect LLM hallucinations relative to private or retrieved context
* [**Toxicity**](../llm-evals/running-pre-tested-evals/toxicity.md) -  Identify if the AI response is racist, biased, or toxic

#### Question Generation

In addition to evaluating queries, Phoenix can also use your data to generate questions to evaluate on. This means that you can automatically generate synthetic questions and run and evaluation pipeline to test if the LLM can actually answer questions accurately using your data. The RAG evaluations use-case highlights this end-to-end evaluation pipeline ([see tutorial)](../use-cases/rag-evaluation.md).

#### Running Response Evaluations

{% hint style="info" %}
Already have a dataset of queries, responses, and context? You can jump directly to [Broken link](broken-reference "mention")
{% endhint %}

###

### Retrieval Evaluation

Phoenix also provides evaluation of retrieval independently.

The concept of retrieval evaluation is not new; given a set of relevance scores for a set of retrieved documents, we  can evaluate retrievers using retrieval metrics like `precision`, `NDCG`,  `hit rate` and more.

LLM Evals supports the following retireval evaluation criteria:

* [**Relevance**](../llm-evals/running-pre-tested-evals/retrieval-rag-relevance.md) - Evaluates whether a retrieved document chunk contains an answer to the query. It's extremely useful for evaluating retrieval systems.

#### Running Retireval Evaluations



### Evaluating Traces

<figure><img src="https://github.com/Arize-ai/phoenix-assets/blob/main/images/blog/evaluations_on_traces.png?raw=true" alt=""><figcaption><p>Adding evaluations on traces can highlight problematic areas that require further analysis</p></figcaption></figure>

````python
```notebook-python
from phoenix.trace import DocumentEvaluations

# Log response evaluations to phoenix via SpanEvaluations
px.log_evaluations(
    SpanEvaluations(eval_name="Hallucination", dataframe=hallucination_eval),
    SpanEvaluations(eval_name="QA Correctness", dataframe=qa_correctness_eval),
)

# Log documen evaluations for retrieval analysis
px.log_evaluations(DocumentEvaluations(eval_name="Relevance", dataframe=retrieved_documents_eval))

````

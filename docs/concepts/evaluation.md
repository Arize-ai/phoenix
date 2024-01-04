---
description: >-
  Evaluation and benchmarking are crucial concepts in LLM development. To
  improve the performance of an LLM app (RAG, agents), you must have a way to
  measure it.
---

# Evaluation

Phoenix offers key modules to measure the quality of generated results as well as modulues to measure retrieval quality.

* **Response Evaluation**: Does the response match the retrieved context? Does it also match the query?&#x20;
* **Retrieval Evaluation**: Are the retrieved sources relevant to the query?

### Response Evaluation

Evaluation of generated results can be challenging. Unlike traditional ML, the predicted result s are not numeric or categorical, making it hard to define quantitative metrics for this problem.

Phoenix offers [LLM Evaluations](broken-reference), a module designed to measure the quality of results. This module uses a "gold" LLM (e.x. GPT-4) to decide whether the generated answer is correct in a variety of ways.\
\
Note that many of these evaluation criteria DO NOT require ground-truth labels. Evaluation can be done simply with a combination of the **input** (query), **output** (response), and **context**.

LLM Evals supports the following response evaluation criteria:\


* **QA Correctness** - Whether a question was correctly answered by the system based on the retrieved data. In contrast to retrieval Evals that are checks on chunks of data returned, this check is a system level check of a correct Q\&A.
* **Hallucinations -** Designed to detect LLM hallucinations relative to private or retrieved context

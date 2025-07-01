---
description: Benchmarking Chunk Size, K and Retrieval Approach
---

# Benchmarking Retrieval

{% embed url="https://colab.research.google.com/drive/1Siufl13rLI-kII1liaNfvf-NniBdwUpS?usp=sharing" %}

{% embed url="https://www.youtube.com/watch?v=eLXivBehPGo" %}
Video That Reviews the Material
{% endembed %}

The advent of LLMs is causing a rethinking of the possible architectures of retrieval systems that have been around for decades.

The core use case for RAG (Retrieval Augmented Generation) is the connecting of an LLM to private data, empower an LLM to know your data and respond based on the private data you fit into the context window.

As teams are setting up their retrieval systems understanding performance and configuring the parameters around RAG (type of retrieval, chunk size, and K) is currently a guessing game for most teams.

{% embed url="https://storage.googleapis.com/arize-phoenix-assets/assets/images/RAG_llm_architecture.png" %}

The above picture shows the a typical retrieval architecture designed for RAG, where there is a vector DB, LLM and an optional Framework.

This section will go through a script that iterates through all possible parameterizations of setting up a retrieval system and use Evals to understand the trade offs.

This overview will run through the scripts in Phoenix for performance analysis of RAG setup:

{% embed url="https://raw.githubusercontent.com/Arize-ai/phoenix/main/scripts/rag/llama_index_w_evals_and_qa.py" %}

{% embed url="https://raw.githubusercontent.com/Arize-ai/phoenix/main/scripts/rag/plotresults.py" %}

The scripts above power the included notebook.

### Retrieval Performance Analysis

The typical flow of retrieval is a user query is embedded and used to search a vector store for chunks of relevant data.

**The core issue of retrieval performance:** The chunks returned might or might not be able to answer your main question. They might be _semantically similar_ but **not usable** to create an answer the question!

The eval template is used to evaluate the relevance of each chunk of data. The Eval asks the main question of "Does the chunk of data contain relevant information to answer the question"?

The Retrieval Eval is used to analyze the performance of each chunk within the ordered list retrieved.

The Evals generated on each chunk can then be used to generate more traditional search and retreival metrics for the retrieval system. We highly recommend that teams at least look at traditional search and retrieval metrics such as:

* MRR
* Precision @ K
* NDCG

These metrics have been used for years to help judge how well your search and retrieval system is returning the right documents to your context window.

These metrics can be used overall, by cluster (UMAP), or on individual decisions, making them very powerful to track down problems from the simplest to the most complex.

Retrieval Evals just gives an idea of what and how much of the "right" data is fed into the context window of your RAG, it does not give an indication if the final answer was correct.

### Q\&A Evals

The Q\&A Evals work to give a user an idea of whether the overall system answer was correct. This is typically what the system designer cares the most about and is one of the most important metrics.

The above Eval shows how the query, chunks and answer are used to create an overall assessment of the entire system.

The above Q\&A Eval shows how the Query, Chunk and Answer are used to generate a % incorrect for production evaluations.

### Results

The results from the runs will be available in the directory.

Underneath `experiment_data` there are two sets of metrics:

* The first set of results removes the cases where there are 0 retrieved relevant documents. There are cases where some clients test sets have a large number of questions where the documents can not answer. This can skew the metrics a lot.
* The second set of results is unfiltered and shows the raw metrics for every retrieval.

{% embed url="https://storage.googleapis.com/arize-assets/phoenix/assets/images/percentage_incorrect_plot.png" %}

The above picture shows the results of benchmark sweeps across your retrieval system setup. The lower the percent the better the results. This is the Q\&A Eval.

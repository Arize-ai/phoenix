---
description: Benchmarking Chunk Size, K and Retrieval Approach
---

# Benchmarking Retrieval (RAG)

{% embed url="https://colab.research.google.com/drive/1Siufl13rLI-kII1liaNfvf-NniBdwUpS?usp=sharing" %}

{% embed url="https://www.youtube.com/watch?v=eLXivBehPGo" %}
Video That Reviews the Material&#x20;
{% endembed %}

The advent of LLMs is causing a rethinking of the possible architectures of retrieval systems that have been around for decades.&#x20;

The core use case for RAG (Retrieval Augmented Generation) is the connecting of an LLM to private data, empower an LLM to know your data and respond based on the private data you fit into the context window.&#x20;

As teams are setting up their retrieval systems understanding performance and configuring the parameters around RAG (type of retrieval, chunk size, and K) is currently a guessing game for most teams.&#x20;

<figure><img src="../.gitbook/assets/Screenshot 2023-10-09 at 11.22.11 AM.png" alt=""><figcaption><p>RAG Architecture</p></figcaption></figure>

The above picture shows the a typical retrieval architecture designed for RAG, where there is a vector DB, LLM and an optional Framework.&#x20;

This section will go through a script that iterates through all possible parameterizations of setting up a retrieval system and use Evals to understand the trade offs.

&#x20;

<figure><img src="../.gitbook/assets/Screenshot 2023-10-09 at 11.31.03 AM.png" alt=""><figcaption><p>Retrieval Parameterization</p></figcaption></figure>

This overview will run through the scripts in phoenix for performance analysis of RAG setup:

{% embed url="https://github.com/Arize-ai/phoenix/blob/main/scripts/rag/llama_index_w_evals_and_qa.py" %}
Link to RAG Scripts
{% endembed %}

The scripts above power the included notebook.

### Retrieval Performance Analysis

The typical flow of retrieval is a user query is embedded and used to search a vector store for chunks of relevant data.&#x20;

**The core issue of retrieval performance:** The chunks returned might or might not be able to answer your main question. They might be _semantically similar_ but **not usable** to create an answer the question!

<figure><img src="../.gitbook/assets/Screenshot 2023-10-09 at 11.28.39 AM.png" alt=""><figcaption><p>Retrieval Evals</p></figcaption></figure>

&#x20; The eval template is used to evaluate the relevance of each chunk of data. The Eval asks the main question of "Does the chunk of data contain relevant information to answer the question"?

<figure><img src="../.gitbook/assets/Screenshot 2023-10-09 at 11.59.47 AM.png" alt=""><figcaption><p>Retrieval Eval</p></figcaption></figure>

The Retrieval Eval is used to analyze the performance of each chunk within the ordered list retrieved.

<figure><img src="../.gitbook/assets/Screenshot 2023-10-09 at 12.02.24 PM.png" alt=""><figcaption><p>Retrieval Performance</p></figcaption></figure>

The Evals generated on each chunk can then be used to generate more traditional search and retreival metrics for the retrieval system. We highly recommend that teams at least look at traditional search and retrieval metrics such as:\


* MRR
* Precision @ K
* NDCG

These metrics have been used for years to help judge how well your search and retrieval system is returning the right documents to your context window.

These metrics can be used overall, by cluster (UMAP), or on individual decisions, making them very powerful to track down problems from the simplest to the most complex.&#x20;

Retrieval Evals just gives an idea of what and how much of the "right" data is fed into the context window of your RAG, it does not give an indication if the final answer was correct.&#x20;

### Q\&A Evals

The Q\&A Evals work to give a user an idea of whether the overall system answer was correct. This is typically what the system designer cares the most about and is one of the most important metrics.&#x20;

<figure><img src="../.gitbook/assets/Screenshot 2023-10-09 at 12.16.18 PM.png" alt=""><figcaption><p>Overall Q&#x26;A Eval</p></figcaption></figure>

The above Eval shows how the query, chunks and answer are used to create an overall assessment of the entire system.&#x20;

<figure><img src="../.gitbook/assets/Screenshot 2023-10-09 at 12.20.11 PM.png" alt=""><figcaption><p>Correct Evals</p></figcaption></figure>

The above Q\&A Eval shows how the Query, Chunk and Answer are used to generate a % incorrect for production evaluations.&#x20;

### Results

The results from the runs will be available in the directory:

experiment\_data/

Underneath experiment\_data there are two sets of metrics:

The first set of results removes the cases where there are 0 retrieved relevant documents. There are cases where some clients test sets have a large number of questions where the documents can not answer. This can skew the metrics a lot. &#x20;

experiment\_data/results\_zero\_removed

The second set of results is unfiltered and shows the raw metrics for every retrieval.&#x20;

experiment\_data/results\_zero\_not\_removed

<figure><img src="../.gitbook/assets/Screenshot 2023-10-09 at 2.39.24 PM.png" alt=""><figcaption><p>Q&#x26;A Question and Answer % Incorrect</p></figcaption></figure>

The above picture shows the results of benchmark sweeps across your retrieval system setup. The lower the percent the better the results. This is the Q\&A Eval.

<figure><img src="../.gitbook/assets/Screenshot 2023-10-09 at 2.40.52 PM.png" alt=""><figcaption><p>MRR Results across different parametrs</p></figcaption></figure>

The above graphs show MRR results across a sweep of different chunk sizes.


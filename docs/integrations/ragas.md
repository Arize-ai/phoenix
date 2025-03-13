---
description: Phoenix and Ragas work hand-in-hand
---

# Ragas

Building a baseline for a RAG pipeline is not usually difficult, but enhancing it to make it suitable for production and ensuring the quality of your responses is almost always hard. Choosing the right tools and parameters for RAG can itself be challenging when there is an abundance of options available. With Ragas and Phoenix you create a robust workflow for making the right choices while building your RAG and ensuring its quality.

The tutorial below covers:

* [Ragas](https://colab.research.google.com/corgiredirector?site=https%3A%2F%2Fdocs.ragas.io%2Fen%2Fstable%2F) for synthetic test data generation and evaluation
* Arize AI’s [Phoenix](https://colab.research.google.com/corgiredirector?site=https%3A%2F%2Fdocs.arize.com%2Fphoenix) for tracing, visualization, and cluster analysis
* [LlamaIndex](https://colab.research.google.com/corgiredirector?site=https%3A%2F%2Fdocs.llamaindex.ai%2Fen%2Fstable%2F) for building RAG pipelines

You can also follow along on the [RAGAS docs](https://docs.ragas.io/en/stable/howtos/integrations/_arize/), which mirrors the Colab below.

{% embed url="https://colab.research.google.com/github/Arize-ai/phoenix/blob/main/tutorials/ragas_retrieval_evals_tutorial.ipynb" %}

<figure><img src="../.gitbook/assets/ragas_trace_slide_over.gif" alt=""><figcaption><p>Viewing your LlamaIndex Traces</p></figcaption></figure>

<figure><img src="../.gitbook/assets/ragas_evaluation_annotations.gif" alt=""><figcaption><p>Viewing your Ragas Evaluations</p></figcaption></figure>

<figure><img src="../.gitbook/assets/ragas_correctness_clusters.gif" alt=""><figcaption><p>Viewing the Embeddings Space for your RAGAS Evaluations</p></figcaption></figure>

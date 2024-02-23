---
description: >-
  Helps answer questions such as: Are there queries that don’t have sufficient
  context? Should you add more context for these queries to get better answers?
  Or can you change your embeddings?
---

# Retrieval with Embeddings

<table><thead><tr><th width="165">Framework</th><th width="302.3333333333333">Phoenix Inferences</th><th>Phoenix Traces &#x26; Spans</th></tr></thead><tbody><tr><td>LangChain</td><td><strong>Retrieval Analyzer w/ Embeddings</strong> <a href="https://colab.research.google.com/github/Arize-ai/phoenix/blob/main/tutorials/langchain_pinecone_search_and_retrieval_tutorial.ipynb"><img src="https://img.shields.io/static/v1?message=Open%20in%20Colab&#x26;logo=googlecolab&#x26;labelColor=grey&#x26;color=blue&#x26;logoColor=orange&#x26;label=%20" alt="Open in Colab"></a></td><td><strong>Traces and Spans</strong> <a href="https://colab.research.google.com/github/Arize-ai/phoenix/blob/main/tutorials/tracing/langchain_tracing_tutorial.ipynb"><img src="https://img.shields.io/static/v1?message=Open%20in%20Colab&#x26;logo=googlecolab&#x26;labelColor=grey&#x26;color=blue&#x26;logoColor=orange&#x26;label=%20" alt="Open in Colab"></a></td></tr><tr><td>LlamaIndex</td><td><strong>Retrieval Analyzer w/ Embeddings</strong><a href="https://colab.research.google.com/github/Arize-ai/phoenix/blob/main/tutorials/llama_index_search_and_retrieval_tutorial.ipynb"><img src="https://img.shields.io/static/v1?message=Open%20in%20Colab&#x26;logo=googlecolab&#x26;labelColor=grey&#x26;color=blue&#x26;logoColor=orange&#x26;label=%20" alt="Open in Colab"></a></td><td><strong>Traces and Spans</strong> <a href="https://colab.research.google.com/github/Arize-ai/phoenix/blob/main/tutorials/tracing/llama_index_tracing_tutorial.ipynb"><img src="https://img.shields.io/static/v1?message=Open%20in%20Colab&#x26;logo=googlecolab&#x26;labelColor=grey&#x26;color=blue&#x26;logoColor=orange&#x26;label=%20" alt="Open in Colab"></a></td></tr></tbody></table>

## Overview

{% hint style="info" %}
**Q\&A with Retrieval at a Glance**

**LLM Input:** User Query + retrieved document

**LLM Output:** Response based on query + document

**Evaluation Metrics:**

1. Did the LLM answer the question correctly (correctness)
2. For each retrieved document, is the document relevant to answer the user query?
{% endhint %}

Possibly the most common use-case for creating a LLM application is to connect an LLM to proprietary data such as enterprise documents or video transcriptions. Applications such as these often times are built on top of LLM frameworks such as [Langchain](https://github.com/langchain-ai/langchain) or [llama\_index](https://github.com/run-llama/llama\_index), which have first-class support for vector store retrievers. Vector Stores enable teams to connect their own data to LLMs. A common application is chatbots looking across a company's knowledge base/context to answer specific questions.

<figure><img src="../.gitbook/assets/image.png" alt=""><figcaption></figcaption></figure>

## How to Evaluate Retrieval Systems

There are varying degrees of how we can evaluate retrieval systems.

Step 1: First we care if the chatbot is correctly answering the user's questions. Are there certain types of questions the chatbot gets wrong more often?

Step 2: Once we know there's an issue, then we need metrics to trace where specifically did it go wrong. Is the issue with retrieval? Are the documents that the system retrieves irrelevant?

Step 3: If retrieval is not the issue, we should check if we even have the right documents to answer the question.

<figure><img src="../.gitbook/assets/image (10).png" alt=""><figcaption></figcaption></figure>

<table data-full-width="true"><thead><tr><th width="200">Question</th><th>Metric</th><th>Pros</th><th>Cons</th></tr></thead><tbody><tr><td>Is this a bad response to the answer?</td><td>User feedback or <a href="../evaluation/running-pre-tested-evals/q-and-a-on-retrieved-data.md">LLM Eval for Q&#x26;A</a></td><td>Most relevant way to measure application</td><td>Hard to trace down specifically what to fix</td></tr><tr><td>Is the retrieved context relevant?</td><td><a href="../evaluation/running-pre-tested-evals/retrieval-rag-relevance.md">LLM Eval for Relevance</a></td><td>Directly measures effectiveness of retrieval</td><td>Requires additional LLMs calls</td></tr><tr><td>Is the knowledge base missing areas of user queries?</td><td>Query density (drift) - Phoenix generated</td><td>Highlights groups of queries with large distance from context</td><td>Identifies broad topics missing from knowledge base, but not small gaps</td></tr></tbody></table>

## Using Phoenix Traces & Spans

Visualize the chain of the traces and spans for a Q\&A chatbot use case. You can click into specific spans.

<figure><img src="../.gitbook/assets/image (1).png" alt=""><figcaption></figcaption></figure>

When clicking into the retrieval span, you can see the relevance score for each document. This can surface irrelevant context.

<figure><img src="../.gitbook/assets/image (2).png" alt=""><figcaption></figcaption></figure>

## Using Phoenix Inferences to Analyze RAG (Retrieval Augmented Generation)

### Step 1. Identifying Clusters of Bad Responses

Phoenix surfaces up clusters of similar queries that have poor feedback.

<figure><img src="https://storage.googleapis.com/arize-assets/phoenix/assets/images/RAG_query_density.png" alt=""><figcaption></figcaption></figure>

### Step 2: Irrelevant Documents Being Retrieved

Phoenix can help uncover when irrelevant context is being retrieved using the [LLM Evals for Relevance](../evaluation/running-pre-tested-evals/retrieval-rag-relevance.md). You can look at a cluster's aggregate relevance metric with precision @k, NDCG, MRR, etc to identify where to improve. You can also look at a single prompt/response pair and see the relevance of documents.

<figure><img src="https://storage.googleapis.com/arize-assets/phoenix/assets/images/RAG_LLM_assisted_evals.png" alt=""><figcaption></figcaption></figure>

### Step 3: Don't Have Any Documents Close Enough

Phoenix can help you identify if there is context that is missing from your knowledge base. By visualizing query density, you can understand what topics you need to add additional documentation for in order to improve your chatbots responses.

<figure><img src="https://storage.googleapis.com/arize-assets/phoenix/assets/images/RAG_overview.png" alt=""><figcaption></figcaption></figure>

By setting the "primary" dataset as the user queries, and the "corpus" dataset as the context I have in my vector store, I can see if there are clusters of user query embeddings that have no nearby context embeddings, as seen in the example below.

<figure><img src="https://storage.googleapis.com/arize-assets/phoenix/assets/images/RAG_retrieval_connection.png" alt="" width="563"><figcaption></figcaption></figure>

### Troubleshooting Tip:

{% hint style="success" %}
Found a problematic cluster you want to dig into, but don't want to manually sift through all of the prompts and responses? **Ask chatGPT to help you understand the make up of the cluster.** [**Try out the colab here**](https://colab.research.google.com/github/Arize-ai/phoenix/blob/main/tutorials/find\_cluster\_export\_and\_explore\_with\_gpt.ipynb#scrollTo=Ss2n6JJyLQBm)
{% endhint %}

## How to Log to Phoenix (as Inferences)

<figure><img src="../.gitbook/assets/image (11).png" alt=""><figcaption></figcaption></figure>

#### Step 1: Logging Knowledge Base

The first thing we need is to collect some sample from your vector store, to be able to compare against later. This is to able to see if some sections are not being retrieved, or some sections are getting a lot of traffic where you might want to beef up your context or documents in that area.

For more details, visit this [page](../how-to/define-your-schema/corpus-data.md).

<table><thead><tr><th width="76">id</th><th width="331">text</th><th>embedding</th></tr></thead><tbody><tr><td>1</td><td>Voyager 2 is a spacecraft used by NASA to expl...</td><td>[-0.02785328, -0.04709944, 0.042922903, 0.0559...</td></tr></tbody></table>

```python
corpus_schema = px.Schema(
    id_column_name="id",
    document_column_names=EmbeddingColumnNames(
        vector_column_name="embedding",
        raw_data_column_name="text",
    ),
)
```

#### Step 2: Logging Retrieval and Response

We also will be logging the prompt/response pairs from the deployed application.

For more details, visit this [page](../how-to/define-your-schema/retrieval-rag.md).

<table><thead><tr><th width="159.33333333333331">query</th><th width="125">embedding</th><th width="164">retrieved_document_ids</th><th width="139">relevance_scores</th><th>response</th></tr></thead><tbody><tr><td>who was the first person that walked on the moon</td><td>[-0.0126, 0.0039, 0.0217, ...</td><td>[7395, 567965, 323794, ...</td><td>[11.30, 7.67, 5.85, ...</td><td>Neil Armstrong</td></tr></tbody></table>

```python
primary_schema = Schema(
    prediction_id_column_name="id",
    prompt_column_names=RetrievalEmbeddingColumnNames(
        vector_column_name="embedding",
        raw_data_column_name="query",
        context_retrieval_ids_column_name="retrieved_document_ids",
        context_retrieval_scores_column_name="relevance_scores",
    )
    response_column_names="response",
)
```

####

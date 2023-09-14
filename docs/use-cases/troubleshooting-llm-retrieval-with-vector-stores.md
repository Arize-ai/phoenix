---
description: >-
  Helps answer questions such as: Are there queries that don’t have sufficient
  context? Should you add more context for these queries to get better answers?
  Or can you change your embeddings?
---

# Troubleshooting LLM Search and Retrieval with Vector Stores

Possibly the most common use-case for creating a LLM application is to connect an LLM to proprietary data such as enterprise documents or video transcriptions. Applications such as these often times are built on top of LLM frameworks such as [Langchain](https://github.com/langchain-ai/langchain) or [llama\_index](https://github.com/jerryjliu/llama\_index), which have first-class support for vector store retrievers. Vector Stores enable teams to connect their own data to LLMs. A common application is chatbots looking across a company's knowledge base/context to answer specific questions.&#x20;

{% hint style="info" %}
Retrieval-Augmented Generation or RAG is not limited to vector stores but it is quite common. To learn more about vector stores, consult some of the most popular ones such as [Pinecone](https://www.pinecone.io/), [Qdrant](https://qdrant.tech/), and [Chroma](https://www.trychroma.com/).
{% endhint %}

Try this out on your own with our colabs:

#### Langchain & Pinecone

{% embed url="https://colab.research.google.com/github/Arize-ai/phoenix/blob/main/tutorials/langchain_pinecone_search_and_retrieval_tutorial.ipynb" %}
Evaluating and Improving Search and Retrieval Applications (LangChain, Pinecone)
{% endembed %}

#### Llamaindex

{% embed url="https://colab.research.google.com/github/Arize-ai/phoenix/blob/main/tutorials/llama_index_search_and_retrieval_tutorial.ipynb" %}
Evaluating and Improving Search and Retrieval Applications (LlamaIndex)
{% endembed %}

## How Search and Retrieval Works

Here's an example of what retrieval looks like for a chatbot application. A user asked a specific question, an embedding was generated for the query, all relevant documents in the knowledge base (a vector store such as chroma) was pulled in, and then added into the prompt to the LLM.

{% hint style="info" %}
From here on out we will refer to the data in the knowledge base / vector store as the **corpus.** The content of the corpus will be referred to as documents.
{% endhint %}

<figure><img src="../.gitbook/assets/image (12).png" alt=""><figcaption></figcaption></figure>

## Common Problems with Search and Retrieval Systems

If there isn't enough documents to pull in, then the prompt doesn't have enough context to answer the question.&#x20;

Here's an example of bad retrieval. The chatbot didn't answer the user's question.&#x20;

<figure><img src="../.gitbook/assets/image (13).png" alt=""><figcaption></figcaption></figure>

The question we want to answer is, why did the chatbot not answer the user's question? There are a few common issues we see we'll go into below.

<figure><img src="../.gitbook/assets/image (10).png" alt=""><figcaption></figcaption></figure>

## Logging data to Phoenix for Search and Retrieval Tracing

<figure><img src="../.gitbook/assets/image (11).png" alt=""><figcaption></figcaption></figure>

Before learning how to trace a retrieval system in Phoenix, you need to log the relevant data and metadata.

The first thing we need is to collect some sample from your vector store, to be able to compare against later. This is to able to see if some sections are not being retrieved, or some sections are getting a lot of traffic where you might want to beef up your context or documents in that area.

In addition, the user query is logged as the prompt, and prompt template can also be logged as metadata information alongside the retrieved context. And lastly, the response and user feedback is logged as well.

## Tracing Search and Retrieval Systems with Phoenix&#x20;

### Bad Response

The first issue we see, and often the easiest to uncover is bad responses.

By logging the user feedback to Phoenix, we will automatically surface up any clusters that received poor feedback.

<figure><img src="https://storage.googleapis.com/arize-assets/phoenix/assets/images/RAG_query_density.png" alt=""><figcaption></figcaption></figure>

Bad responses are often the result of something else going on. Your LLM is likely not giving a poor response for no reason. Next, we will show you how to trace it back to the root of the problem.

### Don't Have Any Documents Close Enough

Maybe, it wasn’t able to find any documents that were close enough to the query embedding. This means that users are asking questions about context that is missing from your knowledge base.&#x20;

Phoenix can help you identify if there is context that is missing from your knowledge base.&#x20;

By visualizing query density, you can understand what topics you need to add additional documentation for in order to improve your chatbots responses.&#x20;

<figure><img src="https://storage.googleapis.com/arize-assets/phoenix/assets/images/RAG_overview.png" alt=""><figcaption></figcaption></figure>

<figure><img src="https://storage.googleapis.com/arize-assets/phoenix/assets/images/RAG_retrieval_connection.png" alt=""><figcaption></figcaption></figure>

By setting the "primary" dataset as the user queries, and the "corpus" dataset as the context I have in my vector store, I can see if there are clusters of user query embeddings that have no nearby context embeddings, as seen in the example above.&#x20;

### Most Similar != Most Relevant Document

There is also the possibility that the document that was retrieved was considered most similar, had the closest embedding to the query, but wasn’t actually the most relevant document to answer the user’s question appropriately.

Phoenix can help uncover when irrelevant context is being retrieved with LLM assisted ranking metrics.

By ranking the the relevance of the context retrieved, Phoenix can help you identify areas to dig into to improve the retrieval.

<figure><img src="https://storage.googleapis.com/arize-assets/phoenix/assets/images/RAG_LLM_assisted_evals.png" alt=""><figcaption></figcaption></figure>

### Troubleshooting Tip:

{% hint style="success" %}
Found a problematic cluster you want to dig into, but don't want to manually sift through all of the prompts and responses? **Ask chatGPT to help you understand the make up of the cluster.**
{% endhint %}

All you need to do is click the download a cluster button in Phoenix. The export works by exporting the cluster back to the notebook in a dataframe (see [session](../api/session.md#methods)). Once you've downloaded the cluster, you can ask chatGPT to help with summarizing the data points, such as: "The following is JSON points for a cluster of datapoints. Can you summarize the cluster of data, what do the points have in common?"

Check out our colab for a step by step tutorial.&#x20;

{% embed url="https://colab.research.google.com/github/Arize-ai/phoenix/blob/main/tutorials/find_cluster_export_and_explore_with_gpt.ipynb#scrollTo=Ss2n6JJyLQBm" %}
Find Clusters, Export, and Explore with GPT
{% endembed %}

####

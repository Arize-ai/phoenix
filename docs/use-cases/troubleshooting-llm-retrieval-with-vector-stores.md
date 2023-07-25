---
description: >-
  Helps answer questions such as: Are there queries that don’t have sufficient
  context? Should you add more context for these queries to get better answers?
  Or can you change your embeddings?
---

# Troubleshooting LLM Search and Retrieval with Vector Stores

Vector Stores enable teams to connect their own data to LLMs. A common application is chatbots looking across a company's knowledge base/context to answer specific questions.&#x20;

Try this out on your own with our colabs:

{% embed url="https://colab.research.google.com/github/Arize-ai/phoenix/blob/main/tutorials/langchain_pinecone_search_and_retrieval_tutorial.ipynb" %}
Evaluating and Improving Search and Retrieval Applications (LangChain, Pinecone)
{% endembed %}

{% embed url="https://colab.research.google.com/github/Arize-ai/phoenix/blob/llama-index-docs/llama_index.ipynb" %}
Evaluating and Improving Search and Retrieval Applications (LlamaIndex)
{% endembed %}

Here's an example of what retrieval looks like for a chatbot application. A user asked a specific question, an embedding was generated for the query, all relevant documents in the knowledge base (a vector store such as chroma) was pulled in, and then added into the prompt to the LLM.

{% hint style="info" %}
From here on out we will refer to the data in the knowledge base / vector store as the **corpus.** The content of the corpus will be referred to as documents.
{% endhint %}

<figure><img src="https://storage.cloud.google.com/arize-assets/phoenix/assets/images/RAG_llm_architecture.png" alt=""><figcaption></figcaption></figure>

If there isn't enough documents to pull in, then the prompt doesn't have enough context to answer the question.&#x20;

Here's an example of "bad retrieval". There wasn't enough information about video data quality in the knowledge base to answer the user's question and the chatbot hallucinated.

<figure><img src="https://storage.cloud.google.com/arize-assets/phoenix/assets/images/RAG_llm_app_overview.png" alt=""><figcaption></figcaption></figure>

### How to Troubleshoot Retrieval in Phoenix

#### Step 1: Identify if there is decent overlap between queries and corpus&#x20;

If users are asking questions that have decent overlap with the corpus, then this typically indicates that the knowledge base has enough context to answer user questions. However if there isn't overlap, there are either:

1. Users asking questions that aren't represented in the corpus\

2. There are documents in the corpus not relevant to the queries users are asking

To do this, compare the distance between query and corpus embeddings using the Query Distance (the euclidean distance of the centroid of the queries to the centroid of the corpus).&#x20;

<figure><img src="../.gitbook/assets/image (5).png" alt=""><figcaption><p>Measure Query Distance between query and corpus embeddings</p></figcaption></figure>

#### Step 2: Identify where there is a mismatch

Phoenix will automatically cluster similar topics closer together. By looking at the separate clusters you can see which clusters are made up more of query embeddings, and less corpus embeddings. This results in a mismatch.&#x20;

<figure><img src="../.gitbook/assets/image (8).png" alt=""><figcaption><p>Identify patterns where there are more queries with less documents via % query </p></figcaption></figure>

#### Optional Step 2.5: Ask chatGPT to help you understand the make up of the cluster

All you need to do is click the download a cluster button in Phoenix. The export works by exporting the cluster back to the notebook in a dataframe (see [session](../api/session.md#methods)). Once you've downloaded the cluster, you can ask chatGPT to help with summarizing the data points, such as: "The following is JSON points for a cluster of datapoints. Can you summarize the cluster of data, what do the points have in common?"

Check out our colab for a step by step tutorial.&#x20;

{% embed url="https://colab.research.google.com/github/Arize-ai/phoenix/blob/main/tutorials/find_cluster_export_and_explore_with_gpt.ipynb#scrollTo=Ss2n6JJyLQBm" %}
Find Clusters, Export, and Explore with GPT
{% endembed %}

#### Step 3: Add more specific documents to the vector store

In the example above, there wasn't enough documents on video quality to be able to correctly answer the user questions. Adding more documents can help improve the performance of the chatbot, and prevent it from hallucinating when providing a response to a similar question.&#x20;

<figure><img src="../.gitbook/assets/image (2).png" alt="" width="301"><figcaption><p>Add more "video quality" documentation to your vector store, so there is more context for your chatbot. </p></figcaption></figure>

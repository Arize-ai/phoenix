---
description: >-
  Start answering questions such as: Are there queries that don’t have context
  embeddings? Should you add more context for these queries to get better
  answers? Or can you change your embeddings?
---

# Troubleshooting LLM Retrieval with Vector Stores

Vector Stores enable teams to connect their own data to LLMs. A common application is chatbots looking across a company's knowledge base/context to answer specific questions.&#x20;

Here's an example of what retrieval looks like for a chatbot application. A user asked a specific question, an embedding was generated for the query, all relevant context in the knowledge base was pulled in, and then added into the prompt to the LLM.

<figure><img src="../.gitbook/assets/image (3).png" alt=""><figcaption></figcaption></figure>

If there isn't enough context to pull in, then the prompt doesn't have enough context to answer the question.&#x20;

Here's an example of "bad retrieval". There wasn't enough information about video data quality in the knowledge base to answer the user's question and the chatbot hallucinated.

<figure><img src="../.gitbook/assets/image (7).png" alt=""><figcaption></figcaption></figure>

### How to Troubleshoot Retrieval in Phoenix

#### Step 1: Identify if there is decent overlap between queries and context&#x20;

If users are asking questions that have decent overlap with context, then this dictates the knowledge base has enough context to answer user questions. However if there isn't overlap, there are either:

1. Users asking questions that aren't in the knowledge store (bigger issue)
2. There are documents in the knowledge store not getting hit with queries

To do this, compare the distance between query and context embeddings using Euclidean Distance.

<figure><img src="../.gitbook/assets/image (5).png" alt=""><figcaption><p>Measure Euclidean Distance between query and context embeddings</p></figcaption></figure>

#### Step 2: Identify where there is a mismatch

Phoenix will automatically cluster similar topics closer together. By looking at the separate clusters you can see which clusters are made up more of query embeddings, and less context embeddings. This results in a mismatch.&#x20;

<figure><img src="../.gitbook/assets/image (8).png" alt=""><figcaption><p>Identify patterns where there are more queries with less context </p></figcaption></figure>

#### Optional Step 2.5: Ask chatGPT to help you understand the make up of the cluster

All you need to do is click the download a cluster button in Phoenix. The export works by exporting the cluster back to the notebook in a dataframe. Once you've downloaded the cluster, you can ask chatGPT tohelp with summarizing the data points, such as: "The following is JSON points for a cluster of datapoints. Can you summarize the cluster of data, what do the points have in common?"

Check out our colab for a step by step tutorial.&#x20;

{% embed url="https://colab.research.google.com/github/Arize-ai/phoenix/blob/main/tutorials/find_cluster_export_and_explore_with_gpt.ipynb#scrollTo=Ss2n6JJyLQBm" %}

#### Step 3: Add more specific context to the vector store

In the example above, there wasn't enough context on video quality to be able to correctly answer the user questions. Adding more context can help improve the performance of the chatbot, and prevent it from hallucinating when providing a response to a similar question.&#x20;

<figure><img src="../.gitbook/assets/image (2).png" alt="" width="301"><figcaption><p>Add more "video quality" documentation to your vector store, so there is more context for your chatbot. </p></figcaption></figure>

# Overview: Retrieval

Many LLM applications use a technique called Retrieval Augmented Generation. These applications retrieve data from their knowledge base to help the LLM accomplish tasks with the appropriate context.&#x20;

However, these retrieval systems can still hallucinate or provide answers that are not relevant to the user's input query. We can evaluate retrieval systems by checking for:

1. Are there certain types of questions the chatbot gets wrong more often?
2. Are the documents that the system retrieves irrelevant? Do we have the right documents to answer the question?
3. Does the response match the provided documents?

<figure><img src="../.gitbook/assets/image (10).png" alt=""><figcaption></figcaption></figure>

Phoenix supports retrievals troubleshooting and evaluation on both traces and inferences, but inferences are currently required to visualize your retrievals using a UMAP. See below on the differences.

| Feature                                | Traces & Spans    | Inferences                |
| -------------------------------------- | ----------------- | ------------------------- |
| Troubleshooting for LLM applications   | ✅                 | ✅                         |
| Follow the entirety of an LLM workflow | ✅                 | 🚫 support for spans only |
| Embeddings Visualizer                  | 🚧 on the roadmap | ✅                         |

Check out our [quickstart on retrieval](quickstart-retrieval.md) to get started. Look at our [retrieval concepts ](concepts-retrieval/)to better understand how to troubleshoot and evaluate different kinds of retrieval systems. For a high level overview on evaluation, check out our [evaluation overview](../llm-evals/llm-evals.md).

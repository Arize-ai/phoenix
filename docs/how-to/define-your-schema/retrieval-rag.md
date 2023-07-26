---
description: How to import data for the Retrieval-Augmented Generation (RAG) use case
---

# Retrieval (RAG)

In Retrieval-Augmented Generation (RAG), the retrieval step returns from the knowledge base (or [corpus](corpus-data.md)) a list of documents relevant to the user query, then the generation step adds the retrieved documents to the prompt context to improve response accuracy of the Large Language Model (LLM). The IDs of the retrieval documents along with the relevance scores, if present, can be imported into Phoenix as follows.

## Dataframe

Below shows only the relevant subsection of the dataframe. The `retrieved_document_ids` should matched the `id`s in the [corpus](corpus-data.md) data. Note that for each row, the list under the `relevance_scores` column have a matching length as the one under the `retrievals` column. But it's not necessary for all retrieval lists to have the same length.

<table><thead><tr><th width="219.33333333333331">query</th><th width="141">embedding</th><th width="220">retrieved_document_ids</th><th>relevance_scores</th></tr></thead><tbody><tr><td>who was the first person that walked on the moon</td><td>[-0.0126, 0.0039, 0.0217, ...</td><td>[7395, 567965, 323794, ...</td><td>[11.30, 7.67, 5.85, ...</td></tr><tr><td>who was the 15th prime minister of australia</td><td>[0.0351, 0.0632, -0.0609, ...</td><td>[38906, 38909, 38912, ...</td><td>[11.28, 9.10, 8.39, ...</td></tr><tr><td>why is amino group in aniline an ortho para di...</td><td>[-0.0431, -0.0407, -0.0597, ...</td><td>[779579, 563725, 309367, ...</td><td>[-10.89, -10.90, -10.94, ...</td></tr></tbody></table>

## Schema

Both the `retrievals` and `scores` are grouped under `prompt_column_names` along with the `embedding` of the `query`.

```
primary_schema = Schema(
    prediction_id_column_name="id",
    prompt_column_names=RetrievalEmbeddingColumnNames(
        vector_column_name="embedding",
        raw_data_column_name="query",
        context_retrieval_ids_column_name="retrieved_document_ids",
        context_retrieval_scores_column_name="relevance_scores",
    )
)
```

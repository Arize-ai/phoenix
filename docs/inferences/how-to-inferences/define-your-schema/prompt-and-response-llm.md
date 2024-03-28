---
description: How to import prompt and response from Large Large Model (LLM)
---

# Prompt and Response (LLM)

For the Retrieval-Augmented Generation (RAG) use case, see the [Retrieval](../../../how-to/define-your-schema/retrieval-rag.md) section.

## Dataframe

Below shows a relevant subsection of the dataframe. The `embedding` of the prompt is also shown.

<table><thead><tr><th width="287.3333333333333">prompt</th><th width="210">embedding</th><th>response</th></tr></thead><tbody><tr><td>who was the first person that walked on the moon</td><td>[-0.0126, 0.0039, 0.0217, ...</td><td>Neil Alden Armstrong</td></tr><tr><td>who was the 15th prime minister of australia</td><td>[0.0351, 0.0632, -0.0609, ...</td><td>Francis Michael Forde</td></tr></tbody></table>

## Schema

See [Retrieval](../../../how-to/define-your-schema/retrieval-rag.md) for the Retrieval-Augmented Generation (RAG) use case where relevant documents are retrieved for the question before constructing the context for the LLM.

```
primary_schema = Schema(
    prediction_id_column_name="id",
    prompt_column_names=EmbeddingColumnNames(
        vector_column_name="embedding",
        raw_data_column_name="prompt",
    )
    response_column_names="response",
)
```

## Dataset

Define the dataset by pairing the dataframe with the schema.

```python
primary_dataset = px.Dataset(primary_dataframe, primary_schema)
```

## Application

```python
session = px.launch_app(primary_dataset)
```

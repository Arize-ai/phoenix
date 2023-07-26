---
description: How to create Phoenix datasets and schemas for the corpus data
---

# Corpus Data

In [Information Retrieval](https://en.wikipedia.org/wiki/Information\_retrieval), a document is any piece of information the user may want to retrieve, e.g. a paragraph, an article, or a Web page, and a collection of documents is referred to as the corpus. A corpus dataset can be imported into Phoenix as shown below.

## Dataframe

Below is an example dataframe containing Wikipedia articles along with its embedding vector.

<table><thead><tr><th width="76">id</th><th width="331">text</th><th>embedding</th></tr></thead><tbody><tr><td>1</td><td>Voyager 2 is a spacecraft used by NASA to expl...</td><td>[-0.02785328, -0.04709944, 0.042922903, 0.0559...</td></tr><tr><td>2</td><td>The Staturn Nebula is a planetary nebula in th...</td><td>[0.03544901, 0.039175965, 0.014074919, -0.0307...</td></tr><tr><td>3</td><td>Eris is a dwarf planet and a trans-Neptunian o...</td><td>[0.05506449, 0.0031612846, -0.020452883, -0.02...</td></tr></tbody></table>

## Schema

Below is an appropriate schema for the dataframe above. It specifies the `id` column and that  `embedding` belongs to `text`. Other columns, if exist, will be detected automatically, and need not be specified by the schema.

```python
corpus_schema = px.Schema(
    id_column_name="id",
    document_column_names=EmbeddingColumnNames(
        vector_column_name="embedding",
        raw_data_column_name="text",
    ),
)
```

## Dataset

Define the dataset by pairing the dataframe with the schema.

```python
corpus_dataset = px.Dataset(corpus_dataframe, corpus_schema)
```

## Application

The [application](../manage-the-app.md#launch-the-app) launcher accepts the corpus dataset through `corpus=` parameter.

```python
session = px.launch_app(production_dataset, corpus=corpus_dataset)
```

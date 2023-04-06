---
description: Take your first flight with Phoenix in your Jupyter or Colab notebook
---

# Quickstart

[![Open in Colab](https://img.shields.io/static/v1?message=Open%20in%20Colab\&logo=googlecolab\&labelColor=grey\&color=blue\&logoColor=orange\&label=%20)](https://colab.research.google.com/github/Arize-ai/phoenix/blob/main/tutorials/quickstart.ipynb) [![Open in GitHub](https://img.shields.io/static/v1?message=Open%20in%20GitHub\&logo=github\&labelColor=grey\&color=blue\&logoColor=white\&label=%20)](https://github.com/Arize-ai/phoenix/blob/main/tutorials/quickstart.ipynb)

In this quickstart, you will:

* Download curated datasets of embeddings and predictions and load them into a pandas DataFrame
* Define a schema to describe the format of your data
* Launch Phoenix and explore the app

Let's get started!

## Install Dependencies and Import Libraries

Install Phoenix and its dependencies in your notebook environment.

{% tabs %}
{% tab title="Install from Notebook Cell" %}
In a notebook cell, execute

```python
%pip install arize-phoenix
```
{% endtab %}

{% tab title="Install from Terminal" %}
From your terminal, run

```
pip install arize-phoenix
```
{% endtab %}
{% endtabs %}

Import libraries for the quickstart.

```python
from dataclasses import replace
import pandas as pd
import phoenix as px
```

## Download the Data

Download the curated dataset.

```python
train_df = pd.read_parquet(
    "https://storage.googleapis.com/arize-assets/phoenix/datasets/unstructured/cv/human-actions/human_actions_training.parquet"
)
prod_df = pd.read_parquet(
    "https://storage.googleapis.com/arize-assets/phoenix/datasets/unstructured/cv/human-actions/human_actions_production.parquet"
)
```

## Launch Phoenix

### a) Define Your Schema

To launch Phoenix with your data, you first need to define a schema that tells Phoenix which columns of your DataFrames correspond to features, predictions, actuals (i.e., ground truth), embeddings, etc.

The trickiest part is defining [embedding features](concepts/embeddings.md#whats-an-embedding). In this case, each embedding feature has two pieces of information: the embedding vector itself contained in the "image\_vector" column and the link to the image contained in the "url" column.

Define a schema for your training data.

```python
train_schema = px.Schema(
    timestamp_column_name="prediction_ts",
    prediction_label_column_name="predicted_action",
    actual_label_column_name="actual_action",
    embedding_feature_column_names={
        "image_embedding": px.EmbeddingColumnNames(
            vector_column_name="image_vector",
            link_to_data_column_name="url",
        ),
    },
)
```

The schema for your production data is the same, except it does not have an actual label column.

```python
prod_schema = replace(train_schema, actual_label_column_name=None)
```

### b) Define Your Datasets

Next, define your primary and reference datasets. In this case, your reference dataset contains training data and your primary dataset contains production data.

```python
prod_ds = px.Dataset(prod_df, prod_schema)
train_ds = px.Dataset(train_df, train_schema)
```

### c) Create a Phoenix Session

```python
session = px.launch_app(prod_ds, train_ds)
```

### d) Launch the Phoenix UI

Launch the Phoenix UI either within your notebook or in a separate browser tab or window.

{% tabs %}
{% tab title="In the Browser" %}
In a notebook cell, run

```python
session.url
```

Copy and paste the output URL into a new browser tab or window.
{% endtab %}

{% tab title="In Your Notebook" %}
In a notebook cell, run

```python
session.view()
```

The Phoenix UI will appear in an inline frame in the cell output.
{% endtab %}
{% endtabs %}

## Explore the App

Click on "image\_embedding" in the "Embeddings" section to visualize your embedding data. What insights can you uncover from this page?

## Close the App

When you're done, don't forget to close the app.

```python
px.close_app()
```

## Next Steps

Congrats! You've taken your first flight with Phoenix. We recommend that you next:

* Understand the [foundational concepts of the Phoenix API](concepts/phoenix-basics.md)
* Experiment with our end-to-end [example notebooks](tutorials/notebooks.md)
* Learn how to [use Phoenix with your own data](how-to/define-your-schema.md) and how to [manage the app](how-to/manage-the-app.md).

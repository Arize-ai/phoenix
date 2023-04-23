---
description: Take your first flight with Phoenix in your Jupyter or Colab notebook
---

# NLP

[![Open in Colab](https://img.shields.io/static/v1?message=Open%20in%20Colab\&logo=googlecolab\&labelColor=grey\&color=blue\&logoColor=orange\&label=%20)](https://colab.research.google.com/github/Arize-ai/phoenix/blob/main/tutorials/quickstart.ipynb) [![Open in GitHub](https://img.shields.io/static/v1?message=Open%20in%20GitHub\&logo=github\&labelColor=grey\&color=blue\&logoColor=white\&label=%20)](https://github.com/Arize-ai/phoenix/blob/main/tutorials/quickstart.ipynb)

Install Phoenix.

```python
!pip install -q arize-phoenix
```

Import dependencies.

```python
import pandas as pd
import phoenix as px
```

Download training and production data from a model that classifies the sentiment of product reviews as positive, negative, or neutral.

```python
train_df = pd.read_parquet(
    "https://storage.googleapis.com/arize-assets/phoenix/datasets/unstructured/nlp/sentiment-classification-language-drift/sentiment_classification_language_drift_training.parquet",
)
prod_df = pd.read_parquet(
    "https://storage.googleapis.com/arize-assets/phoenix/datasets/unstructured/nlp/sentiment-classification-language-drift/sentiment_classification_language_drift_production.parquet",
)
```

View a few training data points.

```python
train_df.head()
```

| index | prediction\_ts | reviewer\_age | reviewer\_gender | product\_category | language | text                                              | text\_vector                                       | label    | pred\_label | prediction\_id                       |
| ----- | -------------- | ------------- | ---------------- | ----------------- | -------- | ------------------------------------------------- | -------------------------------------------------- | -------- | ----------- | ------------------------------------ |
| 0     | 1.650092e+09   | 21            | female           | apparel           | english  | Poor quality of fabric and ridiculously tight ... | \[-0.070516996, 0.6640034, 0.33579218, -0.26907... | negative | negative    | 8e6aa6b9-1c64-4f14-89ca-4fa13f9bdf22 |
| 1     | 1.650093e+09   | 29            | male             | kitchen           | english  | Love these glasses, thought they'd be everyday... | \[-0.0024410924, -0.5406275, 0.31713492, -0.033... | positive | positive    | b2e80b12-eaea-4ce5-952d-8bb47ae850e8 |
| 2     | 1.650093e+09   | 26            | female           | sports            | english  | These are disgusting, it tastes like you are "... | \[0.40487882, 0.8235396, 0.38333943, -0.4269158... | negative | negative    | d405e813-e120-4209-bf56-0f3b3eb15a10 |
| 3     | 1.650093e+09   | 26            | male             | other             | english  | My husband has a pair of TaoTronics so I decid... | \[0.018816521, 0.53441304, 0.4907303, -0.024163... | neutral  | neutral     | 2707a745-6cc2-4690-96d8-7a4c0d25eae4 |
| 4     | 1.650093e+09   | 37            | male             | home\_improvement | english  | Threads too deep. Engages on tank, but gasket ... | \[-0.25348073, 0.31603432, 0.35810202, -0.24672... | negative | negative    | db0f1d5a-ea00-44e4-ae61-47db679a1e54 |

The columns of the DataFrame are:

* **prediction\_ts:** the Unix timestamps of your predictions
* **review\_age**, **reviewer\_gender**, **product\_category**, **language:** the features of your model
* **text:** the text of each product review
* **text\_vector:** the embedding vectors representing each review
* **pred\_label:** the label your model predicted
* **label:** the ground-truth label for each review

Define your schema.

```python
schema = px.Schema(
    timestamp_column_name="prediction_ts",
    prediction_label_column_name="pred_label",
    actual_label_column_name="label",
    embedding_feature_column_names={
        "text_embedding": px.EmbeddingColumnNames(
            vector_column_name="text_vector", raw_data_column_name="text"
        ),
    },
)
```

Define your primary and reference datasets.

```python
prim_ds = px.Dataset(dataframe=prod_df, schema=schema, name="production")
ref_ds = px.Dataset(dataframe=train_df, schema=schema, name="training")
```

Launch Phoenix.

```python
session = px.launch_app(primary=prim_ds, reference=ref_ds)
```

Open Phoenix by copying and pasting the output of `session.url` into a new browser tab.

```python
session.url
```

Alternatively, open the Phoenix UI in your notebook.

```python
session.view()
```

Navigate to the embeddings page. Select a period of high drift. Click on the clusters on the left and inspect the data in each cluster. One cluster contains positive reviews, one contains negative reviews, and another contains production data that has drifted from the training distribution.

Close the app.

```python
px.close_app()
```

## Next Steps

Congrats! You've taken your first flight with Phoenix. We recommend that you next:

* Understand the [foundational concepts of the Phoenix API](../concepts/phoenix-basics.md)
* Experiment with our end-to-end [example notebooks](notebooks.md)
* Learn how to [use Phoenix with your own data](../how-to/define-your-schema.md) and how to [manage the app](../how-to/manage-the-app.md)

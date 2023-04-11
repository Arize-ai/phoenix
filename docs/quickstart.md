---
description: Take your first flight with Phoenix in your Jupyter or Colab notebook
---

# Quickstart

[![Open in Colab](https://img.shields.io/static/v1?message=Open%20in%20Colab\&logo=googlecolab\&labelColor=grey\&color=blue\&logoColor=orange\&label=%20)](https://colab.research.google.com/github/Arize-ai/phoenix/blob/main/tutorials/quickstart.ipynb) [![Open in GitHub](https://img.shields.io/static/v1?message=Open%20in%20GitHub\&logo=github\&labelColor=grey\&color=blue\&logoColor=white\&label=%20)](https://github.com/Arize-ai/phoenix/blob/main/tutorials/quickstart.ipynb)

This quickstart dives straight into the code with minimal explanation. Click below to explore the capabilities of Phoenix for various tasks.

<table data-view="cards"><thead><tr><th align="center"></th><th data-hidden data-card-target data-type="content-ref"></th></tr></thead><tbody><tr><td align="center"><strong>Computer Vision</strong></td><td><a href="quickstart.md#computer-vision">#computer-vision</a></td></tr><tr><td align="center"><strong>Natural Language Processing</strong></td><td><a href="quickstart.md#natural-language-processing">#natural-language-processing</a></td></tr><tr><td align="center"><strong>Tabular Data</strong></td><td><a href="quickstart.md#tabular-data">#tabular-data</a></td></tr></tbody></table>

## Computer Vision

Install Phoenix.

```python
!pip install arize-phoenix
```

Import dependencies.

```python
import uuid
from dataclasses import replace
from datetime import datetime

from IPython.display import display, HTML
import pandas as pd
import phoenix as px
```

Download production and training image data containing photographs of people performing various actions (sleeping, eating, running, etc.).

```python
train_df = pd.read_parquet(
    "https://storage.googleapis.com/arize-assets/phoenix/datasets/unstructured/cv/human-actions/human_actions_training.parquet"
)
prod_df = pd.read_parquet(
    "https://storage.googleapis.com/arize-assets/phoenix/datasets/unstructured/cv/human-actions/human_actions_production.parquet"
)
```

View a few training data points.

```python
train_df.head()
```

|   | prediction\_id                       | prediction\_ts | url                                               | image\_vector                                      | actual\_action | predicted\_action |
| - | ------------------------------------ | -------------- | ------------------------------------------------- | -------------------------------------------------- | -------------- | ----------------- |
| 0 | 595d87df-5d50-4d60-bc5f-3ad1cc483190 | 1.655757e+09   | https://storage.googleapis.com/arize-assets/fi... | \[0.26720312, 0.02652928, 0.0, 0.028591828, 0.0... | drinking       | drinking          |
| 1 | 37596b85-c007-4e4f-901d-b87e5297d4b8 | 1.655757e+09   | https://storage.googleapis.com/arize-assets/fi... | \[0.08745878, 0.0, 0.16057675, 0.036570743, 0.0... | fighting       | fighting          |
| 2 | b048d389-539a-4ffb-be61-2f4daa52e700 | 1.655757e+09   | https://storage.googleapis.com/arize-assets/fi... | \[0.9822482, 0.0, 0.037284207, 0.017358225, 0.2... | clapping       | clapping          |
| 3 | 3e00c023-49b4-49c2-9922-7ecbf1349c04 | 1.655757e+09   | https://storage.googleapis.com/arize-assets/fi... | \[0.028404092, 0.063946, 1.0448836, 0.65191674,... | fighting       | fighting          |
| 4 | fb38b050-fb12-43af-b27d-629653b5df86 | 1.655758e+09   | https://storage.googleapis.com/arize-assets/fi... | \[0.06121698, 0.5172761, 0.50730985, 0.5771937,... | sitting        | sitting           |

The columns of the DataFrame are:

* **prediction\_id:** a unique identifier for each data point
* **prediction\_ts:** the Unix timestamps of your predictions
* **url:** a link to the image data
* **image\_vector:** the embedding vectors representing each image
* **actual\_action:** the ground truth for each image (sleeping, eating, running, etc.)
* **predicted\_action:** the predicted class for the image

View a few production data points.

```python
prod_df.head()
```

|   | prediction\_id                       | prediction\_ts | url                                               | image\_vector                                      | predicted\_action |
| - | ------------------------------------ | -------------- | ------------------------------------------------- | -------------------------------------------------- | ----------------- |
| 0 | 8fa8d06a-3dba-46c4-b134-74b7f3eb479b | 1.657053e+09   | https://storage.googleapis.com/arize-assets/fi... | \[0.38830394, 0.13084425, 0.026343096, 0.426129... | hugging           |
| 1 | 80138725-1dbd-46cf-9754-5de495b2d5fc | 1.657053e+09   | https://storage.googleapis.com/arize-assets/fi... | \[0.38679752, 0.33045158, 0.032496776, 0.001283... | laughing          |
| 2 | 0d2d4bb7-ff80-46c5-8134-e5191ad56c73 | 1.657053e+09   | https://storage.googleapis.com/arize-assets/fi... | \[0.041905474, 0.057079148, 0.0, 0.24986057, 0.... | drinking          |
| 3 | 050fe2b2-bb72-4092-8294-cff9f8d07d10 | 1.657053e+09   | https://storage.googleapis.com/arize-assets/fi... | \[0.14649533, 0.18736616, 0.043569583, 1.226385... | sleeping          |
| 4 | ada433c5-2251-49d3-9cd7-33718f814034 | 1.657053e+09   | https://storage.googleapis.com/arize-assets/fi... | \[0.7338474, 0.09456189, 0.83416396, 0.09127828... | fighting          |

Notice that the production data is missing ground truth, i.e., has no "actual\_action" column.

Display a few images alongside their predicted and actual labels.

```python
def display_examples(df):
    """
    Displays each image alongside the actual and predicted classes.
    """
    sample_df = df[["actual_action", "predicted_action", "url"]].rename(columns={"url": "image"})
    html = sample_df.to_html(
        escape=False, index=False, formatters={"image": lambda url: f'<img src="{url}">'}
    )
    display(HTML(html))


display_examples(train_df.head())
```

| actual\_action | predicted\_action | image                                                                                                                                        |
| -------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| drinking       | drinking          | ![](https://storage.googleapis.com/arize-assets/fixtures/Embeddings/CV-public-images/human-actions-quality-drift/training/drinking/0000.png) |
| fighting       | fighting          | ![](https://storage.googleapis.com/arize-assets/fixtures/Embeddings/CV-public-images/human-actions-quality-drift/training/fighting/0000.png) |
| clapping       | clapping          | ![](https://storage.googleapis.com/arize-assets/fixtures/Embeddings/CV-public-images/human-actions-quality-drift/training/clapping/0000.png) |
| fighting       | fighting          | ![](https://storage.googleapis.com/arize-assets/fixtures/Embeddings/CV-public-images/human-actions-quality-drift/training/fighting/0001.png) |
| sitting        | sitting           | ![](https://storage.googleapis.com/arize-assets/fixtures/Embeddings/CV-public-images/human-actions-quality-drift/training/sitting/0000.png)  |

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

Define your primary and reference datasets.

```python
prod_ds = px.Dataset(prod_df, prod_schema)
train_ds = px.Dataset(train_df, train_schema)
```

Launch Phoenix.

```python
session = px.launch_app(prod_ds, train_ds)
```

Open the Phoenix UI by copying and pasting the session URL into a new browser tab.

```python
session.url
```

Alternatively, open the Phoenix UI in your notebook.

```python
session.view()
```

Navigate to the embeddings view. Find a cluster of blurry or noisy production data and export the cluster.

View the exported cluster as a DataFrame in your notebook.

```python
export_df = session.exports[-1]
export_df.head()
```

|   | prediction\_ts            | url                                               | image\_vector                                      | predicted\_action | prediction\_id                       | actual\_action |
| - | ------------------------- | ------------------------------------------------- | -------------------------------------------------- | ----------------- | ------------------------------------ | -------------- |
| 0 | 2022-07-22 21:02:56+00:00 | https://storage.googleapis.com/arize-assets/fi... | \[0.0011560977, 0.0, 0.0, 0.0027169597, 0.0, 0.... | laughing          | 5f3a6e34-90ff-4a4a-8f62-0944167b88f3 | None           |
| 1 | 2022-07-22 21:26:24+00:00 | https://storage.googleapis.com/arize-assets/fi... | \[0.031172704, 0.2109866, 0.93904704, 0.1283793... | running           | 9648a836-a98c-4566-85e0-bf6cb645016e | None           |
| 2 | 2022-07-22 22:06:56+00:00 | https://storage.googleapis.com/arize-assets/fi... | \[0.18106054, 0.0, 0.0, 0.092003256, 0.0, 0.0, ... | laughing          | c766333c-892a-4379-a230-f2eeb5623d4e | None           |
| 3 | 2022-07-22 22:13:20+00:00 | https://storage.googleapis.com/arize-assets/fi... | \[0.02828996, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.4... | laughing          | afbb1958-694b-410c-90e7-66df4d5aba18 | None           |
| 4 | 2022-07-22 22:21:52+00:00 | https://storage.googleapis.com/arize-assets/fi... | \[0.038466103, 0.0, 0.0, 0.0035848748, 0.002207... | laughing          | 1fd96b50-3b3b-4e06-b1da-5ad52f402d6a | None           |

Display a few examples from your exported data.

```python
display_examples(export_df.head())
```

| actual\_action | predicted\_action | image                                                                                                                                               |
| -------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| None           | laughing          | ![](https://storage.googleapis.com/arize-assets/fixtures/Embeddings/CV-public-images/human-actions-quality-drift/production/sitting/0635.png)       |
| None           | running           | ![](https://storage.googleapis.com/arize-assets/fixtures/Embeddings/CV-public-images/human-actions-quality-drift/production/fighting/0626.png)      |
| None           | laughing          | ![](https://storage.googleapis.com/arize-assets/fixtures/Embeddings/CV-public-images/human-actions-quality-drift/production/using\_laptop/0634.png) |
| None           | laughing          | ![](https://storage.googleapis.com/arize-assets/fixtures/Embeddings/CV-public-images/human-actions-quality-drift/production/hugging/0682.png)       |
| None           | laughing          | ![](https://storage.googleapis.com/arize-assets/fixtures/Embeddings/CV-public-images/human-actions-quality-drift/production/calling/0687.png)       |

Close the app.

```python
px.close_app()
```

## Natural Language Processing

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

<div>
<style scoped>
    .dataframe tbody tr th:only-of-type {
        vertical-align: middle;
    }

    .dataframe tbody tr th {
        vertical-align: top;
    }

    .dataframe thead th {
        text-align: right;
    }
</style>
<table border="1" class="dataframe">
  <thead>
    <tr style="text-align: right;">
      <th></th>
      <th>prediction_ts</th>
      <th>reviewer_age</th>
      <th>reviewer_gender</th>
      <th>product_category</th>
      <th>language</th>
      <th>text</th>
      <th>text_vector</th>
      <th>label</th>
      <th>pred_label</th>
      <th>prediction_id</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>1.650092e+09</td>
      <td>21</td>
      <td>female</td>
      <td>apparel</td>
      <td>english</td>
      <td>Poor quality of fabric and ridiculously tight ...</td>
      <td>[-0.070516996, 0.6640034, 0.33579218, -0.26907...</td>
      <td>negative</td>
      <td>negative</td>
      <td>8e6aa6b9-1c64-4f14-89ca-4fa13f9bdf22</td>
    </tr>
    <tr>
      <th>1</th>
      <td>1.650093e+09</td>
      <td>29</td>
      <td>male</td>
      <td>kitchen</td>
      <td>english</td>
      <td>Love these glasses, thought they'd be everyday...</td>
      <td>[-0.0024410924, -0.5406275, 0.31713492, -0.033...</td>
      <td>positive</td>
      <td>positive</td>
      <td>b2e80b12-eaea-4ce5-952d-8bb47ae850e8</td>
    </tr>
    <tr>
      <th>2</th>
      <td>1.650093e+09</td>
      <td>26</td>
      <td>female</td>
      <td>sports</td>
      <td>english</td>
      <td>These are disgusting, it tastes like you are "...</td>
      <td>[0.40487882, 0.8235396, 0.38333943, -0.4269158...</td>
      <td>negative</td>
      <td>negative</td>
      <td>d405e813-e120-4209-bf56-0f3b3eb15a10</td>
    </tr>
    <tr>
      <th>3</th>
      <td>1.650093e+09</td>
      <td>26</td>
      <td>male</td>
      <td>other</td>
      <td>english</td>
      <td>My husband has a pair of TaoTronics so I decid...</td>
      <td>[0.018816521, 0.53441304, 0.4907303, -0.024163...</td>
      <td>neutral</td>
      <td>neutral</td>
      <td>2707a745-6cc2-4690-96d8-7a4c0d25eae4</td>
    </tr>
    <tr>
      <th>4</th>
      <td>1.650093e+09</td>
      <td>37</td>
      <td>male</td>
      <td>home_improvement</td>
      <td>english</td>
      <td>Threads too deep. Engages on tank, but gasket ...</td>
      <td>[-0.25348073, 0.31603432, 0.35810202, -0.24672...</td>
      <td>negative</td>
      <td>negative</td>
      <td>db0f1d5a-ea00-44e4-ae61-47db679a1e54</td>
    </tr>
  </tbody>
</table>
</div>

The columns of the DataFrame are:
- **prediction_ts:** the Unix timestamps of your predictions
- **review_age**, **reviewer_gender**, **product_category**, **language:** the features of your model
- **text:** the text of each product review
- **text_vector:** the embedding vectors representing each review
- **pred_label:** the label your model predicted
- **label:** the ground-truth label for each review

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

## Tabular Data

## Next Steps

Congrats! You've taken your first flight with Phoenix. We recommend that you next:

* Understand the [foundational concepts of the Phoenix API](concepts/phoenix-basics.md)
* Experiment with our end-to-end [example notebooks](tutorials/notebooks.md)
* Learn how to [use Phoenix with your own data](how-to/define-your-schema.md) and how to [manage the app](how-to/manage-the-app.md)

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

Install Phoenix and Arize auto-embeddings.

```python
!pip install -q arize-phoenix "arize[AutoEmbeddings]"
```

Import dependencies.

```python
from arize.pandas.embeddings.tabular_generators import EmbeddingGeneratorForTabularFeatures
import pandas as pd
import phoenix as px
import torch
```

Download your training and production data from a fraud detection model.

```python
train_df = pd.read_parquet(
    "https://storage.googleapis.com/arize-assets/phoenix/datasets/structured/credit-card-fraud/credit_card_fraud_train.parquet",
)
prod_df = pd.read_parquet(
    "https://storage.googleapis.com/arize-assets/phoenix/datasets/structured/credit-card-fraud/credit_card_fraud_production.parquet",
)
train_df.head()
```

  <div id="df-d58f1339-e9df-4423-8471-6d3c82410e6a">
    <div class="colab-df-container">
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
      <th>fico_score</th>
      <th>loan_amount</th>
      <th>term</th>
      <th>interest_rate</th>
      <th>installment</th>
      <th>grade</th>
      <th>home_ownership</th>
      <th>annual_income</th>
      <th>verification_status</th>
      <th>pymnt_plan</th>
      <th>...</th>
      <th>actual_label</th>
      <th>predicted_label</th>
      <th>predicted_score</th>
      <th>prediction_id</th>
      <th>age</th>
      <th>state</th>
      <th>merchant_ID</th>
      <th>merchant_risk_score</th>
      <th>prediction_timestamp</th>
      <th>tabular_vector</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>616</td>
      <td>20700.0</td>
      <td>36 months</td>
      <td>13.33</td>
      <td>700.76</td>
      <td>C</td>
      <td>OWN</td>
      <td>7172387</td>
      <td>Source Verified</td>
      <td>n</td>
      <td>...</td>
      <td>not_fraud</td>
      <td>not_fraud</td>
      <td>0.097716</td>
      <td>a19d989d-76ee-416d-b832-bc7bdae1c810</td>
      <td>20</td>
      <td>CA</td>
      <td>Leannon Ward</td>
      <td>23</td>
      <td>1.669853e+09</td>
      <td>[-0.3837759, -0.30560106, 0.43840367, 0.002096...</td>
    </tr>
    <tr>
      <th>1</th>
      <td>642</td>
      <td>12000.0</td>
      <td>36 months</td>
      <td>13.33</td>
      <td>406.24</td>
      <td>C</td>
      <td>RENT</td>
      <td>7590130</td>
      <td>Not Verified</td>
      <td>n</td>
      <td>...</td>
      <td>not_fraud</td>
      <td>not_fraud</td>
      <td>0.149905</td>
      <td>0234fe86-c01f-452b-9c8b-2809306a5a6f</td>
      <td>86</td>
      <td>CA</td>
      <td>Kirlin and Sons</td>
      <td>17</td>
      <td>1.669853e+09</td>
      <td>[-0.36309245, -0.2509997, 0.38966152, 0.008986...</td>
    </tr>
    <tr>
      <th>2</th>
      <td>543</td>
      <td>12000.0</td>
      <td>36 months</td>
      <td>15.27</td>
      <td>417.58</td>
      <td>C</td>
      <td>OWN</td>
      <td>48249</td>
      <td>Not Verified</td>
      <td>n</td>
      <td>...</td>
      <td>not_fraud</td>
      <td>not_fraud</td>
      <td>0.209666</td>
      <td>8aab2000-bbf0-4b12-9b83-c88a45bf3501</td>
      <td>51</td>
      <td>TX</td>
      <td>Reilly LLC</td>
      <td>78</td>
      <td>1.669853e+09</td>
      <td>[-0.3961212, -0.32158342, 0.44024423, 0.038749...</td>
    </tr>
    <tr>
      <th>3</th>
      <td>616</td>
      <td>7500.0</td>
      <td>36 months</td>
      <td>9.99</td>
      <td>241.97</td>
      <td>B</td>
      <td>OWN</td>
      <td>94880</td>
      <td>Not Verified</td>
      <td>n</td>
      <td>...</td>
      <td>uncertain</td>
      <td>uncertain</td>
      <td>0.147598</td>
      <td>6f24df12-5531-4557-a11e-e9baa312ad75</td>
      <td>25</td>
      <td>TX</td>
      <td>Schiller Ltd</td>
      <td>49</td>
      <td>1.669853e+09</td>
      <td>[-0.37020123, -0.28127947, 0.44664872, 0.01211...</td>
    </tr>
    <tr>
      <th>4</th>
      <td>614</td>
      <td>10800.0</td>
      <td>36 months</td>
      <td>8.39</td>
      <td>340.38</td>
      <td>A</td>
      <td>LEASE</td>
      <td>83848</td>
      <td>Not Verified</td>
      <td>n</td>
      <td>...</td>
      <td>not_fraud</td>
      <td>fraud</td>
      <td>0.173840</td>
      <td>047817c6-4113-429f-8db3-1a502f8b0fe8</td>
      <td>29</td>
      <td>TX</td>
      <td>Schiller Ltd</td>
      <td>64</td>
      <td>1.669853e+09</td>
      <td>[-0.39094505, -0.2960744, 0.44086558, -0.01314...</td>
    </tr>
  </tbody>
</table>
<p>5 rows × 30 columns</p>
</div>
      <button class="colab-df-convert" onclick="convertToInteractive('df-d58f1339-e9df-4423-8471-6d3c82410e6a')"
              title="Convert this dataframe to an interactive table."
              style="display:none;">

  <svg xmlns="http://www.w3.org/2000/svg" height="24px"viewBox="0 0 24 24"
       width="24px">
    <path d="M0 0h24v24H0V0z" fill="none"/>
    <path d="M18.56 5.44l.94 2.06.94-2.06 2.06-.94-2.06-.94-.94-2.06-.94 2.06-2.06.94zm-11 1L8.5 8.5l.94-2.06 2.06-.94-2.06-.94L8.5 2.5l-.94 2.06-2.06.94zm10 10l.94 2.06.94-2.06 2.06-.94-2.06-.94-.94-2.06-.94 2.06-2.06.94z"/><path d="M17.41 7.96l-1.37-1.37c-.4-.4-.92-.59-1.43-.59-.52 0-1.04.2-1.43.59L10.3 9.45l-7.72 7.72c-.78.78-.78 2.05 0 2.83L4 21.41c.39.39.9.59 1.41.59.51 0 1.02-.2 1.41-.59l7.78-7.78 2.81-2.81c.8-.78.8-2.07 0-2.86zM5.41 20L4 18.59l7.72-7.72 1.47 1.35L5.41 20z"/>
  </svg>
      </button>

  <style>
    .colab-df-container {
      display:flex;
      flex-wrap:wrap;
      gap: 12px;
    }

    .colab-df-convert {
      background-color: #E8F0FE;
      border: none;
      border-radius: 50%;
      cursor: pointer;
      display: none;
      fill: #1967D2;
      height: 32px;
      padding: 0 0 0 0;
      width: 32px;
    }

    .colab-df-convert:hover {
      background-color: #E2EBFA;
      box-shadow: 0px 1px 2px rgba(60, 64, 67, 0.3), 0px 1px 3px 1px rgba(60, 64, 67, 0.15);
      fill: #174EA6;
    }

    [theme=dark] .colab-df-convert {
      background-color: #3B4455;
      fill: #D2E3FC;
    }

    [theme=dark] .colab-df-convert:hover {
      background-color: #434B5C;
      box-shadow: 0px 1px 3px 1px rgba(0, 0, 0, 0.15);
      filter: drop-shadow(0px 1px 2px rgba(0, 0, 0, 0.3));
      fill: #FFFFFF;
    }
  </style>

      <script>
        const buttonEl =
          document.querySelector('#df-d58f1339-e9df-4423-8471-6d3c82410e6a button.colab-df-convert');
        buttonEl.style.display =
          google.colab.kernel.accessAllowed ? 'block' : 'none';

        async function convertToInteractive(key) {
          const element = document.querySelector('#df-d58f1339-e9df-4423-8471-6d3c82410e6a');
          const dataTable =
            await google.colab.kernel.invokeFunction('convertToInteractive',
                                                     [key], {});
          if (!dataTable) return;

          const docLinkHtml = 'Like what you see? Visit the ' +
            '<a target="_blank" href=https://colab.research.google.com/notebooks/data_table.ipynb>data table notebook</a>'
            + ' to learn more about interactive tables.';
          element.innerHTML = '';
          dataTable['output_type'] = 'display_data';
          await google.colab.output.renderOutput(dataTable, element);
          const docLink = document.createElement('div');
          docLink.innerHTML = docLinkHtml;
          element.appendChild(docLink);
        }
      </script>
    </div>
  </div>

The columns of the dataframe are:
- **prediction_id:** the unique ID for each prediction
- **prediction_timestamp:** the timestamps of your predictions
- **predicted_label:** the label your model predicted
- **predicted_score:** the score of each prediction
- **actual_label:** the true, ground-truth label for each prediction (fraud vs. not_fraud)
- **tabular_vector:** pre-computed tabular embeddings for each row of data
- **age:** a tag used to filter your data in the Phoenix UI
- the rest of the columns are features

The cell below computes embeddings for your tabular data from scratch if you have a CUDA-enabled GPU; otherwise, use the pre-computed embeddings downloaded with the rest of your data.

```python
feature_column_names = [
    "fico_score",
    "loan_amount",
    "term",
    "interest_rate",
    "installment",
    "grade",
    "home_ownership",
    "annual_income",
    "verification_status",
    "pymnt_plan",
    "addr_state",
    "dti",
    "delinq_2yrs",
    "inq_last_6mths",
    "mths_since_last_delinq",
    "mths_since_last_record",
    "open_acc",
    "pub_rec",
    "revol_bal",
    "revol_util",
    "state",
    "merchant_ID",
    "merchant_risk_score",
]

if torch.cuda.is_available():
    generator = EmbeddingGeneratorForTabularFeatures(
        model_name="distilbert-base-uncased",
    )
    train_df["tabular_vector"] = generator.generate_embeddings(
        train_df,
        selected_columns=feature_column_names,
    )
    prod_df["tabular_vector"] = generator.generate_embeddings(
        prod_df,
        selected_columns=feature_column_names,
    )
else:
    print("CUDA is not available. Using pre-computed embeddings.")
```

Define your schema.

```python
schema = px.Schema(
    prediction_id_column_name="prediction_id",
    prediction_label_column_name="predicted_label",
    prediction_score_column_name="predicted_score",
    actual_label_column_name="actual_label",
    timestamp_column_name="prediction_timestamp",
    feature_column_names=feature_column_names,
    tag_column_names=["age"],
    embedding_feature_column_names={
        "tabular_embedding": px.EmbeddingColumnNames(
            vector_column_name="tabular_vector",
        ),
    },
)
```

Define your primary and reference datasets.

```python
prod_ds = px.Dataset(dataframe=prod_df, schema=schema, name="production")
train_ds = px.Dataset(dataframe=train_df, schema=schema, name="training")
```

Launch Phoenix.

```python
session = px.launch_app(primary=prod_ds, reference=train_ds)
```

Open Phoenix by copying and pasting the output of `session.url` into a new browser tab.

```python
session.url
```

Alternatively, open the Phoenix UI in your notebook.

```python
session.view()
```

Navigate to the embeddings page. Select a period of high drift. Select a drifted cluster. Color your data by the `merchant_ID` feature. Select a cluster of drifted production data. Notice that much of this data consists of fraudulent transactions from the Scammeds merchant. Export the cluster.

View your most recently exported data as a DataFrame.

```python
export_df = session.exports[-1]
export_df.head()
```

  <div id="df-7424050a-56a5-4ef7-952c-e8094eeb1135">
    <div class="colab-df-container">
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
      <th>fico_score</th>
      <th>loan_amount</th>
      <th>term</th>
      <th>interest_rate</th>
      <th>installment</th>
      <th>grade</th>
      <th>home_ownership</th>
      <th>annual_income</th>
      <th>verification_status</th>
      <th>pymnt_plan</th>
      <th>...</th>
      <th>actual_label</th>
      <th>predicted_label</th>
      <th>predicted_score</th>
      <th>prediction_id</th>
      <th>age</th>
      <th>state</th>
      <th>merchant_ID</th>
      <th>merchant_risk_score</th>
      <th>prediction_timestamp</th>
      <th>tabular_vector</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>599</td>
      <td>24000.0</td>
      <td>36 months</td>
      <td>9.17</td>
      <td>765.10</td>
      <td>B</td>
      <td>MORTGAGE</td>
      <td>37273</td>
      <td>Verified</td>
      <td>n</td>
      <td>...</td>
      <td>fraud</td>
      <td>not_fraud</td>
      <td>1.000000</td>
      <td>c3d671ab-378b-4c5a-908c-7ba758137097</td>
      <td>47</td>
      <td>CA</td>
      <td>Scammeds</td>
      <td>79.0</td>
      <td>2023-01-24 01:00:38.098000+00:00</td>
      <td>[-0.37643525, -0.29411978, 0.4526869, 0.007012...</td>
    </tr>
    <tr>
      <th>1</th>
      <td>503</td>
      <td>10800.0</td>
      <td>36 months</td>
      <td>18.79</td>
      <td>394.74</td>
      <td>E</td>
      <td>RENT</td>
      <td>35791</td>
      <td>Verified</td>
      <td>n</td>
      <td>...</td>
      <td>fraud</td>
      <td>not_fraud</td>
      <td>0.998413</td>
      <td>06338a33-2af4-4d36-b26d-9cbcef26ed7b</td>
      <td>42</td>
      <td>CA</td>
      <td>Scammeds</td>
      <td>65.0</td>
      <td>2023-01-24 01:02:57.534000+00:00</td>
      <td>[-0.355947, -0.25465658, 0.46187162, 0.0156519...</td>
    </tr>
    <tr>
      <th>2</th>
      <td>551</td>
      <td>16000.0</td>
      <td>60 months</td>
      <td>12.69</td>
      <td>361.52</td>
      <td>C</td>
      <td>MORTGAGE</td>
      <td>46799</td>
      <td>Verified</td>
      <td>n</td>
      <td>...</td>
      <td>fraud</td>
      <td>not_fraud</td>
      <td>0.859242</td>
      <td>6143a1a7-07c5-4e29-b9df-2a5cf9cc7b61</td>
      <td>92</td>
      <td>FL</td>
      <td>Scammeds</td>
      <td>75.0</td>
      <td>2023-01-24 01:06:26.689000+00:00</td>
      <td>[-0.38369793, -0.31040847, 0.47383925, 0.01653...</td>
    </tr>
    <tr>
      <th>3</th>
      <td>595</td>
      <td>18375.0</td>
      <td>60 months</td>
      <td>22.40</td>
      <td>511.69</td>
      <td>E</td>
      <td>RENT</td>
      <td>48022</td>
      <td>Verified</td>
      <td>n</td>
      <td>...</td>
      <td>not_fraud</td>
      <td>fraud</td>
      <td>0.133351</td>
      <td>f59a5272-811b-413c-b7d7-7e6fac6b1dc3</td>
      <td>69</td>
      <td>CA</td>
      <td>Scammeds</td>
      <td>67.0</td>
      <td>2023-01-24 01:09:55.843000+00:00</td>
      <td>[-0.37594548, -0.28427985, 0.4825426, 0.033805...</td>
    </tr>
    <tr>
      <th>4</th>
      <td>317</td>
      <td>10800.0</td>
      <td>36 months</td>
      <td>12.29</td>
      <td>360.22</td>
      <td>C</td>
      <td>MORTGAGE</td>
      <td>6161</td>
      <td>Verified</td>
      <td>n</td>
      <td>...</td>
      <td>not_fraud</td>
      <td>not_fraud</td>
      <td>0.218005</td>
      <td>ad30dbcb-b25c-4bda-8d06-ea312f80ff0c</td>
      <td>38</td>
      <td>OH</td>
      <td>Scammeds</td>
      <td>94.0</td>
      <td>2023-01-24 01:19:13.589000+00:00</td>
      <td>[-0.36684346, -0.28798828, 0.4652715, 0.032788...</td>
    </tr>
  </tbody>
</table>
<p>5 rows × 30 columns</p>
</div>
      <button class="colab-df-convert" onclick="convertToInteractive('df-7424050a-56a5-4ef7-952c-e8094eeb1135')"
              title="Convert this dataframe to an interactive table."
              style="display:none;">

  <svg xmlns="http://www.w3.org/2000/svg" height="24px"viewBox="0 0 24 24"
       width="24px">
    <path d="M0 0h24v24H0V0z" fill="none"/>
    <path d="M18.56 5.44l.94 2.06.94-2.06 2.06-.94-2.06-.94-.94-2.06-.94 2.06-2.06.94zm-11 1L8.5 8.5l.94-2.06 2.06-.94-2.06-.94L8.5 2.5l-.94 2.06-2.06.94zm10 10l.94 2.06.94-2.06 2.06-.94-2.06-.94-.94-2.06-.94 2.06-2.06.94z"/><path d="M17.41 7.96l-1.37-1.37c-.4-.4-.92-.59-1.43-.59-.52 0-1.04.2-1.43.59L10.3 9.45l-7.72 7.72c-.78.78-.78 2.05 0 2.83L4 21.41c.39.39.9.59 1.41.59.51 0 1.02-.2 1.41-.59l7.78-7.78 2.81-2.81c.8-.78.8-2.07 0-2.86zM5.41 20L4 18.59l7.72-7.72 1.47 1.35L5.41 20z"/>
  </svg>
      </button>

  <style>
    .colab-df-container {
      display:flex;
      flex-wrap:wrap;
      gap: 12px;
    }

    .colab-df-convert {
      background-color: #E8F0FE;
      border: none;
      border-radius: 50%;
      cursor: pointer;
      display: none;
      fill: #1967D2;
      height: 32px;
      padding: 0 0 0 0;
      width: 32px;
    }

    .colab-df-convert:hover {
      background-color: #E2EBFA;
      box-shadow: 0px 1px 2px rgba(60, 64, 67, 0.3), 0px 1px 3px 1px rgba(60, 64, 67, 0.15);
      fill: #174EA6;
    }

    [theme=dark] .colab-df-convert {
      background-color: #3B4455;
      fill: #D2E3FC;
    }

    [theme=dark] .colab-df-convert:hover {
      background-color: #434B5C;
      box-shadow: 0px 1px 3px 1px rgba(0, 0, 0, 0.15);
      filter: drop-shadow(0px 1px 2px rgba(0, 0, 0, 0.3));
      fill: #FFFFFF;
    }
  </style>

      <script>
        const buttonEl =
          document.querySelector('#df-7424050a-56a5-4ef7-952c-e8094eeb1135 button.colab-df-convert');
        buttonEl.style.display =
          google.colab.kernel.accessAllowed ? 'block' : 'none';

        async function convertToInteractive(key) {
          const element = document.querySelector('#df-7424050a-56a5-4ef7-952c-e8094eeb1135');
          const dataTable =
            await google.colab.kernel.invokeFunction('convertToInteractive',
                                                     [key], {});
          if (!dataTable) return;

          const docLinkHtml = 'Like what you see? Visit the ' +
            '<a target="_blank" href=https://colab.research.google.com/notebooks/data_table.ipynb>data table notebook</a>'
            + ' to learn more about interactive tables.';
          element.innerHTML = '';
          dataTable['output_type'] = 'display_data';
          await google.colab.output.renderOutput(dataTable, element);
          const docLink = document.createElement('div');
          docLink.innerHTML = docLinkHtml;
          element.appendChild(docLink);
        }
      </script>
    </div>
  </div>

Close the app.

```python
px.close_app()
```

## Next Steps

Congrats! You've taken your first flight with Phoenix. We recommend that you next:

* Understand the [foundational concepts of the Phoenix API](concepts/phoenix-basics.md)
* Experiment with our end-to-end [example notebooks](tutorials/notebooks.md)
* Learn how to [use Phoenix with your own data](how-to/define-your-schema.md) and how to [manage the app](how-to/manage-the-app.md)

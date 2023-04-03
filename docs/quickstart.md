---
description: Take your first flight with Phoenix
---

# Quickstart

In this quickstart, you will:

* Download curated datasets of embeddings and predictions
* Define a schema to describe the format of your data
* Launch Phoenix to visually explore your embeddings
* Investigate problematic clusters
* Export problematic production data for labeling and fine-tuning

Follow along in your local Jupyter environment or in Colab to take your first flight with Phoenix.

[![Open in Colab](https://img.shields.io/static/v1?message=Open%20in%20Colab\&logo=googlecolab\&labelColor=grey\&color=blue\&logoColor=orange\&label=%20)](https://colab.research.google.com/github/Arize-ai/phoenix/blob/main/tutorials/image\_classification\_tutorial.ipynb) [![Open in GitHub](https://img.shields.io/static/v1?message=Open%20in%20GitHub\&logo=github\&labelColor=grey\&color=blue\&logoColor=white\&label=%20)](https://github.com/Arize-ai/phoenix/blob/main/tutorials/image\_classification\_tutorial.ipynb)

## 1. Install Dependencies and Import Libraries

Install Phoenix and its dependencies in your notebook environment.

{% tabs %}
{% tab title="Install from Terminal" %}
From your terminal, run

```
pip install arize-phoenix
```
{% endtab %}

{% tab title="Install from Notebook Cell" %}
In a notebook cell, execute

```python
%pip install arize-phoenix
```
{% endtab %}
{% endtabs %}

Import the modules needed to run this quickstart.

```python
import uuid
from dataclasses import replace
from datetime import datetime

from IPython.display import display, HTML
import pandas as pd
import phoenix as px
```

## 2. Download and Inspect the Data

Download the curated dataset.

```python
train_df = pd.read_parquet("https://storage.googleapis.com/arize-assets/phoenix/datasets/unstructured/cv/human-actions/human_actions_training.parquet")
prod_df = pd.read_parquet("https://storage.googleapis.com/arize-assets/phoenix/datasets/unstructured/cv/human-actions/human_actions_production.parquet")
```

View the first few rows of the training DataFrame.

```python
train_df.head()
```

_Cell Output:_

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
* **image\_vector:** the embedding vectors representing each review
* **actual\_action:** the ground truth for each image (sleeping, eating, running, etc.)
* **predicted\_action:** the predicted class for the image

View the first few rows of the production DataFrame.

```python
prod_df.head()
```

_Cell Output:_

|   | prediction\_id                       | prediction\_ts | url                                               | image\_vector                                      | predicted\_action |
| - | ------------------------------------ | -------------- | ------------------------------------------------- | -------------------------------------------------- | ----------------- |
| 0 | 8fa8d06a-3dba-46c4-b134-74b7f3eb479b | 1.657053e+09   | https://storage.googleapis.com/arize-assets/fi... | \[0.38830394, 0.13084425, 0.026343096, 0.426129... | hugging           |
| 1 | 80138725-1dbd-46cf-9754-5de495b2d5fc | 1.657053e+09   | https://storage.googleapis.com/arize-assets/fi... | \[0.38679752, 0.33045158, 0.032496776, 0.001283... | laughing          |
| 2 | 0d2d4bb7-ff80-46c5-8134-e5191ad56c73 | 1.657053e+09   | https://storage.googleapis.com/arize-assets/fi... | \[0.041905474, 0.057079148, 0.0, 0.24986057, 0.... | drinking          |
| 3 | 050fe2b2-bb72-4092-8294-cff9f8d07d10 | 1.657053e+09   | https://storage.googleapis.com/arize-assets/fi... | \[0.14649533, 0.18736616, 0.043569583, 1.226385... | sleeping          |
| 4 | ada433c5-2251-49d3-9cd7-33718f814034 | 1.657053e+09   | https://storage.googleapis.com/arize-assets/fi... | \[0.7338474, 0.09456189, 0.83416396, 0.09127828... | fighting          |

Notice that the production data is missing ground truth, i.e., has no "actual\_action" column.

Display a few training images alongside their predicted and actual labels.

```python
def display_examples(df):
    """
    Displays each image alongside the actual and predicted classes.
    """
    sample_df = df[["actual_action", "predicted_action", "url"]].rename(columns={"url": "image"})
    html = sample_df.to_html(escape=False, index=False, formatters={"image": lambda url: f'<img src="{url}">'})
    display(HTML(html))
    
display_examples(train_df.head())
```

_Cell Output:_

| actual\_action | predicted\_action | image                                                                                                                                        |
| -------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| drinking       | drinking          | ![](https://storage.googleapis.com/arize-assets/fixtures/Embeddings/CV-public-images/human-actions-quality-drift/training/drinking/0000.png) |
| fighting       | fighting          | ![](https://storage.googleapis.com/arize-assets/fixtures/Embeddings/CV-public-images/human-actions-quality-drift/training/fighting/0000.png) |
| clapping       | clapping          | ![](https://storage.googleapis.com/arize-assets/fixtures/Embeddings/CV-public-images/human-actions-quality-drift/training/clapping/0000.png) |
| fighting       | fighting          | ![](https://storage.googleapis.com/arize-assets/fixtures/Embeddings/CV-public-images/human-actions-quality-drift/training/fighting/0001.png) |
| sitting        | sitting           | ![](https://storage.googleapis.com/arize-assets/fixtures/Embeddings/CV-public-images/human-actions-quality-drift/training/sitting/0000.png)  |

## 3. Prepare the Data

The original data is from April 2022. Update the timestamps to the current time.

```python
latest_timestamp = max(prod_df['prediction_ts'])
current_timestamp = datetime.timestamp(datetime.now())
delta = current_timestamp - latest_timestamp

train_df['prediction_ts'] = (train_df['prediction_ts'] + delta).astype(float)
prod_df['prediction_ts'] = (prod_df['prediction_ts'] + delta).astype(float)
```

## 4. Launch Phoenix

### a) Define Your Schema

To launch Phoenix with your data, you first need to define a schema that tells Phoenix which columns of your DataFrames correspond to features, predictions, actuals (i.e., ground truth), embeddings, etc.

The trickiest part is defining embedding features. In this case, each embedding feature has two pieces of information: the embedding vector itself contained in the "image\_vector" column and the link to the image contained in the "url" column.

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

_Cell Output:_

```
    🌍 To view the Phoenix app in your browser, visit http://localhost:6060/
    📺 To view the Phoenix app in a notebook, run `px.active_session().view()`
    📖 For more information on how to use Phoenix, check out https://docs.arize.com/phoenix
```

### d) Launch the Phoenix UI

You can view and interact with the Phoenix UI either directly in your notebook or in a separate browser tab or window.

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

## 5. Find and Export Problematic Clusters

### Steps

1. Click on "image\_embedding" in the "Embeddings" section.
2. In the Euclidean distance graph at the top of the page, select a point on the graph where the Euclidean distance is high.
3. Click on the top cluster in the panel on the left.
4. Use the panel at the bottom to examine the data points in this cluster.
5. Click on the "Export" button to save your cluster.

### Q\&A

<details>

<summary>What does the Euclidean distance graph measure?</summary>

This graph measures the drift of your production data relative to your training data over time.

</details>

<details>

<summary>What do the points in the point cloud represent?</summary>

Each point in the point cloud corresponds to an image. Phoenix has taken the high-dimensional embeddings in your original DataFrame and has reduced the dimensionality so that you can view them in lower dimensions.

</details>

<details>

<summary>What do you notice about the cluster you selected?</summary>

It consists almost entirely of production data, meaning that your model is seeing data in production the likes of which it never saw during training.

</details>

<details>

<summary>What's gone wrong with your model in production?</summary>

Your model was trained crisp and high-resolution images. In production, your model is encountering blurry and noisy images that it cannot correctly classify.

</details>

## 6. Load and View Exported Data

View your exported files.

```python
session.exports
```

_Cell Output:_

```
    [<Parquet file: 2023-04-02_14-34-17>]
```

Load your most recent exported data back into a DataFrame.

```python
export_df = session.exports[0].dataframe
export_df.head()
```

_Cell Output:_

|   | prediction\_id | prediction\_ts                   | url                                               | image\_vector                                      | predicted\_action | actual\_action |
| - | -------------- | -------------------------------- | ------------------------------------------------- | -------------------------------------------------- | ----------------- | -------------- |
| 0 | None           | 2023-03-20 07:54:02.508000+00:00 | https://storage.googleapis.com/arize-assets/fi... | \[0.0, 0.0, 0.11352549, 0.1765915, 0.017586319,... | fighting          | None           |
| 1 | None           | 2023-03-20 10:25:30.508000+00:00 | https://storage.googleapis.com/arize-assets/fi... | \[0.0028297675, 0.0, 0.40331313, 0.049678773, 0... | fighting          | None           |
| 2 | None           | 2023-03-20 16:51:38.508000+00:00 | https://storage.googleapis.com/arize-assets/fi... | \[0.0, 0.0, 0.078446686, 0.054440737, 0.2954721... | fighting          | None           |
| 3 | None           | 2023-03-20 21:07:38.508000+00:00 | https://storage.googleapis.com/arize-assets/fi... | \[0.024461636, 0.0, 0.19307889, 0.0, 0.0, 0.098... | fighting          | None           |
| 4 | None           | 2023-03-21 02:04:10.508000+00:00 | https://storage.googleapis.com/arize-assets/fi... | \[0.0, 0.0, 0.053300317, 0.014195409, 0.0, 0.0,... | fighting          | None           |

Display a few examples from your export.

```python
display_examples(export_df.head())
```

_Cell Output:_

| actual\_action | predicted\_action | image                                                                                                                                          |
| -------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| None           | fighting          | ![](https://storage.googleapis.com/arize-assets/fixtures/Embeddings/CV-public-images/human-actions-quality-drift/production/sleeping/0645.png) |
| None           | fighting          | ![](https://storage.googleapis.com/arize-assets/fixtures/Embeddings/CV-public-images/human-actions-quality-drift/production/fighting/0635.png) |
| None           | fighting          | ![](https://storage.googleapis.com/arize-assets/fixtures/Embeddings/CV-public-images/human-actions-quality-drift/production/texting/0662.png)  |
| None           | fighting          | ![](https://storage.googleapis.com/arize-assets/fixtures/Embeddings/CV-public-images/human-actions-quality-drift/production/fighting/0655.png) |
| None           | fighting          | ![](https://storage.googleapis.com/arize-assets/fixtures/Embeddings/CV-public-images/human-actions-quality-drift/production/running/0735.png)  |

You've pinpointed the blurry or noisy images that are hurting your model's performance in production. As an actionable next step, you can label your exported production data and fine-tune your model to improve performance.

## 7. Close the App

When you're done, don't forget to close the app.

```python
px.close_app()
```

## Next Steps

Congrats! You've taken your first flight with Phoenix. We recommend that you next:

* Understand the [foundational concepts of the Phoenix API](concepts/phoenix-basics.md)
* Experiment with our end-to-end [example notebooks](tutorials/notebooks.md)
* Learn how to [use Phoenix with your own data](how-to/define-your-schema.md) and how to [manage](how-to/manage-the-app.md) and [use the app](broken-reference/)

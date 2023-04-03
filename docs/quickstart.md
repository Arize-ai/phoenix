---
description: Get started with Phoenix in three easy steps
---

# Quickstart

In this quickstart, you will:

- Download curated datasets of embeddings and predictions
- Define a schema to describe the format of your data
- Launch Phoenix to visually explore your embeddings
- Investigate problematic clusters
- Export problematic production data for labeling and fine-tuning

Follow along in your local Jupyter environment or in Colab to take your first flight with Phoenix.

[![Open in Colab](https://img.shields.io/static/v1?message=Open%20in%20Colab\&logo=googlecolab\&labelColor=grey\&color=blue\&logoColor=orange\&label=%20)](https://colab.research.google.com/github/Arize-ai/phoenix/blob/main/tutorials/image\_classification\_tutorial.ipynb) [![Open in GitHub](https://img.shields.io/static/v1?message=Open%20in%20GitHub\&logo=github\&labelColor=grey\&color=blue\&logoColor=white\&label=%20)](https://github.com/Arize-ai/phoenix/blob/main/tutorials/image\_classification\_tutorial.ipynb)

## 1. Install Dependencies and Import Libraries

Install Phoenix and its dependencies in your Jupyter or Colab environment.

```
pip install arize-phoenix
```

```python
%pip install arize-phoenix
```

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
      <th>prediction_id</th>
      <th>prediction_ts</th>
      <th>url</th>
      <th>image_vector</th>
      <th>actual_action</th>
      <th>predicted_action</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>595d87df-5d50-4d60-bc5f-3ad1cc483190</td>
      <td>1.655757e+09</td>
      <td>https://storage.googleapis.com/arize-assets/fi...</td>
      <td>[0.26720312, 0.02652928, 0.0, 0.028591828, 0.0...</td>
      <td>drinking</td>
      <td>drinking</td>
    </tr>
    <tr>
      <th>1</th>
      <td>37596b85-c007-4e4f-901d-b87e5297d4b8</td>
      <td>1.655757e+09</td>
      <td>https://storage.googleapis.com/arize-assets/fi...</td>
      <td>[0.08745878, 0.0, 0.16057675, 0.036570743, 0.0...</td>
      <td>fighting</td>
      <td>fighting</td>
    </tr>
    <tr>
      <th>2</th>
      <td>b048d389-539a-4ffb-be61-2f4daa52e700</td>
      <td>1.655757e+09</td>
      <td>https://storage.googleapis.com/arize-assets/fi...</td>
      <td>[0.9822482, 0.0, 0.037284207, 0.017358225, 0.2...</td>
      <td>clapping</td>
      <td>clapping</td>
    </tr>
    <tr>
      <th>3</th>
      <td>3e00c023-49b4-49c2-9922-7ecbf1349c04</td>
      <td>1.655757e+09</td>
      <td>https://storage.googleapis.com/arize-assets/fi...</td>
      <td>[0.028404092, 0.063946, 1.0448836, 0.65191674,...</td>
      <td>fighting</td>
      <td>fighting</td>
    </tr>
    <tr>
      <th>4</th>
      <td>fb38b050-fb12-43af-b27d-629653b5df86</td>
      <td>1.655758e+09</td>
      <td>https://storage.googleapis.com/arize-assets/fi...</td>
      <td>[0.06121698, 0.5172761, 0.50730985, 0.5771937,...</td>
      <td>sitting</td>
      <td>sitting</td>
    </tr>
  </tbody>
</table>
</div>

The columns of the DataFrame are:
- **prediction_id:** a unique identifier for each data point
- **prediction_ts:** the Unix timestamps of your predictions
- **url:** a link to the image data
- **image_vector:** the embedding vectors representing each review
- **actual_action:** the ground truth for each image (sleeping, eating, running, etc.)
- **predicted_action:** the predicted class for the image

View the first few rows of the production DataFrame.

```python
prod_df.head()
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
      <th>prediction_id</th>
      <th>prediction_ts</th>
      <th>url</th>
      <th>image_vector</th>
      <th>predicted_action</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>8fa8d06a-3dba-46c4-b134-74b7f3eb479b</td>
      <td>1.657053e+09</td>
      <td>https://storage.googleapis.com/arize-assets/fi...</td>
      <td>[0.38830394, 0.13084425, 0.026343096, 0.426129...</td>
      <td>hugging</td>
    </tr>
    <tr>
      <th>1</th>
      <td>80138725-1dbd-46cf-9754-5de495b2d5fc</td>
      <td>1.657053e+09</td>
      <td>https://storage.googleapis.com/arize-assets/fi...</td>
      <td>[0.38679752, 0.33045158, 0.032496776, 0.001283...</td>
      <td>laughing</td>
    </tr>
    <tr>
      <th>2</th>
      <td>0d2d4bb7-ff80-46c5-8134-e5191ad56c73</td>
      <td>1.657053e+09</td>
      <td>https://storage.googleapis.com/arize-assets/fi...</td>
      <td>[0.041905474, 0.057079148, 0.0, 0.24986057, 0....</td>
      <td>drinking</td>
    </tr>
    <tr>
      <th>3</th>
      <td>050fe2b2-bb72-4092-8294-cff9f8d07d10</td>
      <td>1.657053e+09</td>
      <td>https://storage.googleapis.com/arize-assets/fi...</td>
      <td>[0.14649533, 0.18736616, 0.043569583, 1.226385...</td>
      <td>sleeping</td>
    </tr>
    <tr>
      <th>4</th>
      <td>ada433c5-2251-49d3-9cd7-33718f814034</td>
      <td>1.657053e+09</td>
      <td>https://storage.googleapis.com/arize-assets/fi...</td>
      <td>[0.7338474, 0.09456189, 0.83416396, 0.09127828...</td>
      <td>fighting</td>
    </tr>
  </tbody>
</table>
</div>

Notice that the production data is missing ground truth, i.e., has no "actual_action" column.

Display a few images alongside their predicted and actual labels. 

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

<table border="1" class="dataframe">
  <thead>
    <tr style="text-align: right;">
      <th>actual_action</th>
      <th>predicted_action</th>
      <th>image</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>drinking</td>
      <td>drinking</td>
      <td><img src="https://storage.googleapis.com/arize-assets/fixtures/Embeddings/CV-public-images/human-actions-quality-drift/training/drinking/0000.png"></td>
    </tr>
    <tr>
      <td>fighting</td>
      <td>fighting</td>
      <td><img src="https://storage.googleapis.com/arize-assets/fixtures/Embeddings/CV-public-images/human-actions-quality-drift/training/fighting/0000.png"></td>
    </tr>
    <tr>
      <td>clapping</td>
      <td>clapping</td>
      <td><img src="https://storage.googleapis.com/arize-assets/fixtures/Embeddings/CV-public-images/human-actions-quality-drift/training/clapping/0000.png"></td>
    </tr>
    <tr>
      <td>fighting</td>
      <td>fighting</td>
      <td><img src="https://storage.googleapis.com/arize-assets/fixtures/Embeddings/CV-public-images/human-actions-quality-drift/training/fighting/0001.png"></td>
    </tr>
    <tr>
      <td>sitting</td>
      <td>sitting</td>
      <td><img src="https://storage.googleapis.com/arize-assets/fixtures/Embeddings/CV-public-images/human-actions-quality-drift/training/sitting/0000.png"></td>
    </tr>
  </tbody>
</table>

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

The trickiest part is defining embedding features. In this case, each embedding feature has two pieces of information: the embedding vector itself contained in the "image_vector" column and the link to the image contained in the "url" column.

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

```
    🌍 To view the Phoenix app in your browser, visit http://localhost:6060/
    📺 To view the Phoenix app in a notebook, run `px.active_session().view()`
    📖 For more information on how to use Phoenix, check out https://docs.arize.com/phoenix
```

### d) Launch the Phoenix UI

You can open Phoenix by copying and pasting the output of `session.url` into a new browser tab.

```python
session.url
```

```
    'http://localhost:6060/'
```

Alternatively, you can open the Phoenix UI in your notebook with

```python
session.view()
```

```
    📺 Opening a view to the Phoenix app. The app is running at http://localhost:6060/
```

## 5. Find and Export Problematic Clusters

### Steps

1. Click on "image_embedding" in the "Embeddings" section.
1. In the Euclidean distance graph at the top of the page, select a point on the graph where the Euclidean distance is high.
1. Click on the top cluster in the panel on the left.
1. Use the panel at the bottom to examine the data points in this cluster.
1. Click on the "Export" button to save your cluster.

### Questions:

1. What does the Euclidean distance graph measure?
1. What do the points in the point cloud represent?
1. What do you notice about the cluster you selected?
1. What's gone wrong with your model in production?

### Answers

1. This graph measures the drift of your production data relative to your training data over time.
1. Each point in the point cloud corresponds to an image. Phoenix has taken the high-dimensional embeddings in your original DataFrame and has reduced the dimensionality so that you can view them in lower dimensions.
1. It consists almost entirely of production data, meaning that your model is seeing data in production the likes of which it never saw during training.
1. Your model was trained crisp and high-resolution images. In production, your model is encountering blurry and noisy images that it cannot correctly classify.

## 6. Load and View Exported Data

View your exported files.

```python
session.exports
```

```
    [<Parquet file: 2023-04-02_14-34-17>]
```

Load your most recent exported data back into a DataFrame.


```python
export_df = session.exports[0].dataframe
export_df.head()
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
      <th>prediction_id</th>
      <th>prediction_ts</th>
      <th>url</th>
      <th>image_vector</th>
      <th>predicted_action</th>
      <th>actual_action</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>None</td>
      <td>2023-03-20 07:54:02.508000+00:00</td>
      <td>https://storage.googleapis.com/arize-assets/fi...</td>
      <td>[0.0, 0.0, 0.11352549, 0.1765915, 0.017586319,...</td>
      <td>fighting</td>
      <td>None</td>
    </tr>
    <tr>
      <th>1</th>
      <td>None</td>
      <td>2023-03-20 10:25:30.508000+00:00</td>
      <td>https://storage.googleapis.com/arize-assets/fi...</td>
      <td>[0.0028297675, 0.0, 0.40331313, 0.049678773, 0...</td>
      <td>fighting</td>
      <td>None</td>
    </tr>
    <tr>
      <th>2</th>
      <td>None</td>
      <td>2023-03-20 16:51:38.508000+00:00</td>
      <td>https://storage.googleapis.com/arize-assets/fi...</td>
      <td>[0.0, 0.0, 0.078446686, 0.054440737, 0.2954721...</td>
      <td>fighting</td>
      <td>None</td>
    </tr>
    <tr>
      <th>3</th>
      <td>None</td>
      <td>2023-03-20 21:07:38.508000+00:00</td>
      <td>https://storage.googleapis.com/arize-assets/fi...</td>
      <td>[0.024461636, 0.0, 0.19307889, 0.0, 0.0, 0.098...</td>
      <td>fighting</td>
      <td>None</td>
    </tr>
    <tr>
      <th>4</th>
      <td>None</td>
      <td>2023-03-21 02:04:10.508000+00:00</td>
      <td>https://storage.googleapis.com/arize-assets/fi...</td>
      <td>[0.0, 0.0, 0.053300317, 0.014195409, 0.0, 0.0,...</td>
      <td>fighting</td>
      <td>None</td>
    </tr>
  </tbody>
</table>
</div>

Display a few examples from your export.


```python
display_examples(export_df.head())
```

<table border="1" class="dataframe">
  <thead>
    <tr style="text-align: right;">
      <th>actual_action</th>
      <th>predicted_action</th>
      <th>image</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>None</td>
      <td>fighting</td>
      <td><img src="https://storage.googleapis.com/arize-assets/fixtures/Embeddings/CV-public-images/human-actions-quality-drift/production/sleeping/0645.png"></td>
    </tr>
    <tr>
      <td>None</td>
      <td>fighting</td>
      <td><img src="https://storage.googleapis.com/arize-assets/fixtures/Embeddings/CV-public-images/human-actions-quality-drift/production/fighting/0635.png"></td>
    </tr>
    <tr>
      <td>None</td>
      <td>fighting</td>
      <td><img src="https://storage.googleapis.com/arize-assets/fixtures/Embeddings/CV-public-images/human-actions-quality-drift/production/texting/0662.png"></td>
    </tr>
    <tr>
      <td>None</td>
      <td>fighting</td>
      <td><img src="https://storage.googleapis.com/arize-assets/fixtures/Embeddings/CV-public-images/human-actions-quality-drift/production/fighting/0655.png"></td>
    </tr>
    <tr>
      <td>None</td>
      <td>fighting</td>
      <td><img src="https://storage.googleapis.com/arize-assets/fixtures/Embeddings/CV-public-images/human-actions-quality-drift/production/running/0735.png"></td>
    </tr>
  </tbody>
</table>

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

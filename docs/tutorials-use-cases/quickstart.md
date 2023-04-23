---
description: Take your first flight with Phoenix in your Jupyter or Colab notebook
---

# Computer Vision

[![Open in Colab](https://img.shields.io/static/v1?message=Open%20in%20Colab\&logo=googlecolab\&labelColor=grey\&color=blue\&logoColor=orange\&label=%20)](https://colab.research.google.com/github/Arize-ai/phoenix/blob/main/tutorials/quickstart.ipynb) [![Open in GitHub](https://img.shields.io/static/v1?message=Open%20in%20GitHub\&logo=github\&labelColor=grey\&color=blue\&logoColor=white\&label=%20)](https://github.com/Arize-ai/phoenix/blob/main/tutorials/quickstart.ipynb)

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

| index | prediction\_id                       | prediction\_ts | url                                               | image\_vector                                      | actual\_action | predicted\_action |
| ----- | ------------------------------------ | -------------- | ------------------------------------------------- | -------------------------------------------------- | -------------- | ----------------- |
| 0     | 595d87df-5d50-4d60-bc5f-3ad1cc483190 | 1.655757e+09   | https://storage.googleapis.com/arize-assets/fi... | \[0.26720312, 0.02652928, 0.0, 0.028591828, 0.0... | drinking       | drinking          |
| 1     | 37596b85-c007-4e4f-901d-b87e5297d4b8 | 1.655757e+09   | https://storage.googleapis.com/arize-assets/fi... | \[0.08745878, 0.0, 0.16057675, 0.036570743, 0.0... | fighting       | fighting          |
| 2     | b048d389-539a-4ffb-be61-2f4daa52e700 | 1.655757e+09   | https://storage.googleapis.com/arize-assets/fi... | \[0.9822482, 0.0, 0.037284207, 0.017358225, 0.2... | clapping       | clapping          |
| 3     | 3e00c023-49b4-49c2-9922-7ecbf1349c04 | 1.655757e+09   | https://storage.googleapis.com/arize-assets/fi... | \[0.028404092, 0.063946, 1.0448836, 0.65191674,... | fighting       | fighting          |
| 4     | fb38b050-fb12-43af-b27d-629653b5df86 | 1.655758e+09   | https://storage.googleapis.com/arize-assets/fi... | \[0.06121698, 0.5172761, 0.50730985, 0.5771937,... | sitting        | sitting           |

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

| index | prediction\_id                       | prediction\_ts | url                                               | image\_vector                                      | predicted\_action |
| ----- | ------------------------------------ | -------------- | ------------------------------------------------- | -------------------------------------------------- | ----------------- |
| 0     | 8fa8d06a-3dba-46c4-b134-74b7f3eb479b | 1.657053e+09   | https://storage.googleapis.com/arize-assets/fi... | \[0.38830394, 0.13084425, 0.026343096, 0.426129... | hugging           |
| 1     | 80138725-1dbd-46cf-9754-5de495b2d5fc | 1.657053e+09   | https://storage.googleapis.com/arize-assets/fi... | \[0.38679752, 0.33045158, 0.032496776, 0.001283... | laughing          |
| 2     | 0d2d4bb7-ff80-46c5-8134-e5191ad56c73 | 1.657053e+09   | https://storage.googleapis.com/arize-assets/fi... | \[0.041905474, 0.057079148, 0.0, 0.24986057, 0.... | drinking          |
| 3     | 050fe2b2-bb72-4092-8294-cff9f8d07d10 | 1.657053e+09   | https://storage.googleapis.com/arize-assets/fi... | \[0.14649533, 0.18736616, 0.043569583, 1.226385... | sleeping          |
| 4     | ada433c5-2251-49d3-9cd7-33718f814034 | 1.657053e+09   | https://storage.googleapis.com/arize-assets/fi... | \[0.7338474, 0.09456189, 0.83416396, 0.09127828... | fighting          |

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

| index | prediction\_ts            | url                                               | image\_vector                                      | predicted\_action | prediction\_id                       | actual\_action |
| ----- | ------------------------- | ------------------------------------------------- | -------------------------------------------------- | ----------------- | ------------------------------------ | -------------- |
| 0     | 2022-07-22 21:02:56+00:00 | https://storage.googleapis.com/arize-assets/fi... | \[0.0011560977, 0.0, 0.0, 0.0027169597, 0.0, 0.... | laughing          | 5f3a6e34-90ff-4a4a-8f62-0944167b88f3 | None           |
| 1     | 2022-07-22 21:26:24+00:00 | https://storage.googleapis.com/arize-assets/fi... | \[0.031172704, 0.2109866, 0.93904704, 0.1283793... | running           | 9648a836-a98c-4566-85e0-bf6cb645016e | None           |
| 2     | 2022-07-22 22:06:56+00:00 | https://storage.googleapis.com/arize-assets/fi... | \[0.18106054, 0.0, 0.0, 0.092003256, 0.0, 0.0, ... | laughing          | c766333c-892a-4379-a230-f2eeb5623d4e | None           |
| 3     | 2022-07-22 22:13:20+00:00 | https://storage.googleapis.com/arize-assets/fi... | \[0.02828996, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.4... | laughing          | afbb1958-694b-410c-90e7-66df4d5aba18 | None           |
| 4     | 2022-07-22 22:21:52+00:00 | https://storage.googleapis.com/arize-assets/fi... | \[0.038466103, 0.0, 0.0, 0.0035848748, 0.002207... | laughing          | 1fd96b50-3b3b-4e06-b1da-5ad52f402d6a | None           |

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

## Next Steps

Congrats! You've taken your first flight with Phoenix. We recommend that you next:

* Understand the [foundational concepts of the Phoenix API](../concepts/phoenix-basics.md)
* Experiment with our end-to-end [example notebooks](notebooks.md)
* Learn how to [use Phoenix with your own data](../how-to/define-your-schema.md) and how to [manage the app](../how-to/manage-the-app.md)

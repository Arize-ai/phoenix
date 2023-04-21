<p align="center">
    <a target="_blank" href="https://arize.com" style="background:none">
        <img alt="phoenix logo" src="https://storage.googleapis.com/arize-assets/phoenix/assets/phoenix-logo-light.svg" width="auto" height="200"></img>
    </a>
    <br/>
    <br/>
    <a href="https://join.slack.com/t/arize-ai/shared_invite/zt-1px8dcmlf-fmThhDFD_V_48oU7ALan4Q">
        <img src="https://img.shields.io/static/v1?message=Community&logo=slack&labelColor=grey&color=blue&logoColor=white&label=%20"/>
    </a>
    <a href="https://pypi.org/project/arize-phoenix/">
        <img src="https://img.shields.io/pypi/v/arize-phoenix?color=blue">
    </a>
    <a href="https://pypi.org/project/arize-phoenix/">
        <img src="https://img.shields.io/pypi/pyversions/arize-phoenix">
    </a>
</p>

Phoenix provides MLOps insights at lightning speed with zero-config observability for model drift, performance, and data quality. Phoenix is notebook-first EDA tool that leverages embeddings to uncover problematic cohorts of your LLM, CV, NLP and tabular models.

<p align="center">
    <img width="auto" src="https://storage.googleapis.com/arize-assets/phoenix/assets/gifs/cv_eda_480px.gif" title="a rotating UMAP point cloud of a computer vision model"></img>
</p>

## Installation

```shell
pip install arize-phoenix
```

## Quickstart

[![Open in Colab](https://img.shields.io/static/v1?message=Open%20in%20Colab&logo=googlecolab&labelColor=grey&color=blue&logoColor=orange&label=%20)](https://colab.research.google.com/github/Arize-ai/phoenix/blob/main/tutorials/quickstart.ipynb) [![Open in GitHub](https://img.shields.io/static/v1?message=Open%20in%20GitHub&logo=github&labelColor=grey&color=blue&logoColor=white&label=%20)](https://github.com/Arize-ai/phoenix/blob/main/tutorials/quickstart.ipynb)

Import libraries.

```python
from dataclasses import replace
import pandas as pd
import phoenix as px
```

Download curated datasets and load them into pandas DataFrames.

```python
train_df = pd.read_parquet(
    "https://storage.googleapis.com/arize-assets/phoenix/datasets/unstructured/cv/human-actions/human_actions_training.parquet"
)
prod_df = pd.read_parquet(
    "https://storage.googleapis.com/arize-assets/phoenix/datasets/unstructured/cv/human-actions/human_actions_production.parquet"
)
```

Define schemas that tell Phoenix which columns of your DataFrames correspond to features, predictions, actuals (i.e., ground truth), embeddings, etc.

```python
train_schema = px.Schema(
    prediction_id_column_name="prediction_id",
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
prod_schema = replace(train_schema, actual_label_column_name=None)
```

Define your production and training datasets.

```python
prod_ds = px.Dataset(prod_df, prod_schema)
train_ds = px.Dataset(train_df, train_schema)
```

Launch the app.

```python
session = px.launch_app(prod_ds, train_ds)
```

You can open Phoenix by copying and pasting the output of `session.url` into a new browser tab.

```python
session.url
```

Alternatively, you can open the Phoenix UI in your notebook with

```python
session.view()
```

When you're done, don't forget to close the app.

```python
px.close_app()
```

## Features

### Embedding Drift Analysis

Explore UMAP point-clouds at times of high euclidean distance and identify clusters of drift.

![Euclidean distance drift analysis](https://storage.googleapis.com/arize-assets/phoenix/assets/images/ner_color_by_correctness.png)

### UMAP-based Exploratory Data Analysis

Color your UMAP point-clouds by your model's dimensions, drift, and performance to identify problematic cohorts.

![UMAP-based EDA](https://storage.googleapis.com/arize-assets/phoenix/assets/images/cv_eda_selection.png)

### Cluster-driven Drift and Performance Analysis

Break-apart your data into clusters of high drift or bad performance using HDBSCAN

![HDBSCAN clusters sorted by drift](https://storage.googleapis.com/arize-assets/phoenix/assets/images/HDBSCAN_drift_analysis.png)

### Exportable Clusters

Export your clusters to `parquet` files or dataframes for further analysis and fine-tuning.

## Documentation

For in-depth examples and explanations, read the [docs](https://docs.arize.com/phoenix).

## Community

Join our community to connect with thousands of machine learning practitioners and ML observability enthusiasts.

-   🌍 Join our [Slack community](https://join.slack.com/t/arize-ai/shared_invite/zt-1px8dcmlf-fmThhDFD_V_48oU7ALan4Q).
-   💡 Ask questions and provide feedback in the _#phoenix-support_ channel.
-   🌟 Leave a star on our [GitHub](https://github.com/Arize-ai/phoenix).
-   🐞 Report bugs with [GitHub Issues](https://github.com/Arize-ai/phoenix/issues).
-   🗺️ Check out our [roadmap](https://github.com/orgs/Arize-ai/projects/45) to see where we're heading next.
-   🎓 Learn the fundamentals of ML observability with our [introductory](https://arize.com/ml-observability-fundamentals/) and [advanced](https://arize.com/blog-course/) courses.

## Thanks

-   [UMAP](https://github.com/lmcinnes/umap) For unlocking the ability to visualize and reason about embeddings
-   [HDBSCAN](https://github.com/scikit-learn-contrib/hdbscan) For providing a clustering algorithm to aid in the discovery of drift and performance degradation

## Copyright, Patent, and License

Copyright 2023 Arize AI, Inc. All Rights Reserved.

Portions of this code are patent protected by one or more U.S. Patents. See [IP_NOTICE](https://github.com/Arize-ai/phoenix/blob/main/IP_NOTICE).

This software is licensed under the terms of the Elastic License 2.0 (ELv2). See [LICENSE](https://github.com/Arize-ai/phoenix/blob/main/LICENSE).

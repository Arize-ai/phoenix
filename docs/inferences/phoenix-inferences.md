---
description: Observability for all model types (LLM, NLP, CV, Tabular)
---

# Quickstart: Inferences

## Overview

Phoenix Inferences allows you to observe the performance of your model through visualizing all the model’s inferences in one interactive UMAP view.

This powerful visualization can be leveraged during EDA to understand model drift, find low performing clusters, uncover retrieval issues, and export data for retraining / fine tuning.

## Quickstart

The following Quickstart can be executed in a Jupyter notebook or Google Colab.

We will begin by logging just a training set. Then proceed to add a production set for comparison.

### Step 1: Install and load dependencies

Use `pip` or `conda`to install `arize-phoenix`. Note that since we are going to do embedding analysis we must also add the embeddings extra.

```python
!pip install 'arize-phoenix[embeddings]'

import phoenix as px
```

### Step 2: Prepare model data

Phoenix visualizes data taken from pandas dataframe, where each row of the dataframe compasses all the information about each inference (including feature values, prediction, metadata, etc.)

For this Quickstart, we will show an example of visualizing the inferences from a computer vision model. See example notebooks for all model types [here](https://docs.arize.com/phoenix/cookbook/end-to-end-examples/data-analysis-embeddings-and-structured-data).

Let’s begin by working with the training set for this model.

Download the dataset and load it into a Pandas dataframe.

```python
import pandas as pd

train_df = pd.read_parquet(
    "http://storage.googleapis.com/arize-assets/phoenix/datasets/unstructured/cv/human-actions/human_actions_training.parquet"
)
```

Preview the dataframe with `train_df.head()` and note that each row contains all the data specific to this CV model for each inference.

```
train_df.head()
```

<figure><img src="../.gitbook/assets/TEMP - inferences df preview - train" alt=""><figcaption></figcaption></figure>

### Step 3: Define a Schema

Before we can log these inferences, we need to define a Schema object to describe them.

The Schema object informs Phoenix of the fields that the columns of the dataframe should map to.

Here we define a Schema to describe our particular CV training set:

```python
# Define Schema to indicate which columns in train_df should map to each field
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

_**Important**_**:** The fields used in a Schema will _vary_ depending on the model type that you are working with.

For examples on how Schema are defined for other model types (NLP, tabular, LLM-based applications), see example notebooks under [Embedding Analysis](https://app.gitbook.com/s/jl0P6vk8OJiHMr4yNY0U/retrieval-and-inferences/guide) and [Structured Data Analysis](https://app.gitbook.com/s/jl0P6vk8OJiHMr4yNY0U/retrieval-and-inferences/guide).

### Step 4: Wrap into Inferences object

Wrap your `train_df` and schema `train_schema` into a Phoenix `Inferences` object:

```python
train_ds = px.Inferences(dataframe=train_df, schema=train_schema, name="training")
```

### Step 5: Launch Phoenix!

We are now ready to launch Phoenix with our Inferences!

Here, we are passing `train_ds` as the `primary` inferences, as we are only visualizing one inference set (see Step 6 for adding additional inference sets).

```python
session = px.launch_app(primary=train_ds)
```

Running this will fire up a Phoenix visualization. Follow in the instructions in the output to view Phoenix in a browser, or in-line in your notebook:

```
🌍 To view the Phoenix app in your browser, visit https://x0u0hsyy843-496ff2e9c6d22116-6060-colab.googleusercontent.com/
📺 To view the Phoenix app in a notebook, run `px.active_session().view()`
📖 For more information on how to use Phoenix, check out https://docs.arize.com/phoenix
```

**You are now ready to observe the training set of your model!**

<div align="left"><figure><img src="../.gitbook/assets/Screenshot 2023-11-06 at 12.28.17 PM.png" alt="" width="241"><figcaption></figcaption></figure></div>

<figure><img src="https://storage.googleapis.com/arize-assets/phoenix/assets/images/HDBSCAN_drift_analysis.png" alt=""><figcaption></figcaption></figure>

:white\_check\_mark: _Checkpoint A._

_Optional - try the following exercises to familiarize yourself more with Phoenix:_

* [ ] Click on `image_embedding` under the Embeddings section to enter the UMAP projector view
* [ ] Select a point where the model accuracy is <0.78, and see the embedding visualization below update to include only points from this selected timeframe
* [ ] Select the cluster with the lowest accuracy; from the list of automatic clusters generated by Phoenix
  * Note that Phoenix automatically generates clusters for you on your data using a clustering algorithm called HDBSCAN (more information: [https://docs.arize.com/phoenix/concepts/embeddings-analysis#clusters](https://docs.arize.com/phoenix/concepts/embeddings-analysis#clusters))
* [ ] Change the colorization of your plot - e.g. select Color By ‘correctness’, and ‘dimension'
* [ ] Describe in words an insight you've gathered from this visualization

_Discuss your answers in our_ [_community_](https://arize-ai.slack.com/join/shared_invite/zt-2w57bhem8-hq24MB6u7yE_ZF_ilOYSBw#/shared-invite/email)_!_

### Step 6 (Optional): Add comparison data

In order to visualize drift, conduct A/B model comparisons, or in the case of an information retrieval use case, compare inferences against a [corpus](https://docs.arize.com/phoenix/~/changes/v6Zhm276x8LlKmwqElIA/how-to/define-your-schema/corpus-data), you will need to add a comparison dataset to your visualization.

We will continue on with our CV model example above, and add a set of production data from our model to our visualization.

This will allow us to analyze drift and conduct A/B comparisons of our production data against our training set.

#### a) Prepare production inferences

```python
prod_df = pd.read_parquet(
    "http://storage.googleapis.com/arize-assets/phoenix/datasets/unstructured/cv/human-actions/human_actions_training.parquet"
)

prod_df.head()
```

<figure><img src="../.gitbook/assets/TEMP - inferences df preview - prod" alt=""><figcaption></figcaption></figure>

#### b) Define model schema

Note that this schema differs slightly from our `train_schema` above, as our `prod_df` does not have a ground truth column!

```python
prod_schema = px.Schema(
    timestamp_column_name="prediction_ts",
    prediction_label_column_name="predicted_action",
    embedding_feature_column_names={
        "image_embedding": px.EmbeddingColumnNames(
            vector_column_name="image_vector",
            link_to_data_column_name="url",
        ),
    },
)
```

{% hint style="info" %}
**When do I need a different schema?**

In general, if both sets of inferences you are visualizing have identical schemas, you can reuse the Schema object.

However, there are often differences between the schema of a primary and reference dataset. For example:

* Your production set does not include any ground truth, but your training set does.
* Your primary dataset is the set of prompt-responses in an LLM application, and your reference is your corpus.
* Your production data has differing timestamps between all inferences, but your training set does not have a timestamp column.

Read more about comparison dataset Schemas here: [How many schemas do I need?](https://docs.arize.com/phoenix/~/changes/v6Zhm276x8LlKmwqElIA/quickstart/inferences#how-many-schemas-do-i-need)
{% endhint %}

#### c) Wrap into Inferences object

```python
prod_ds = px.Inferences(dataframe=prod_df, schema=prod_schema, name="production")
```

#### **d) Launch Phoenix with both Inferences!**

This time, we will include both `train_ds` and `prod_ds` when calling `launch_app`.

```
session = px.launch_app(primary=prod_ds, reference=train_ds)
```

{% hint style="info" %}
**What data should I set as \`reference\` and as \`primary\`?** Select the inferences that you want to use as the referential baseline as your `reference`, and the dataset you'd like to actively evaluate as your `primary.`

In this case, training is our referential baseline, for which we want to gauge the behavior (e.g. evaluate drift) of our production data against.
{% endhint %}

Once again, enter your Phoenix app with the new link generated by your session. e.g.

```
🌍 To view the Phoenix app in your browser, visit https://x0u0hsyy845-496ff2e9c6d22116-6060-colab.googleusercontent.com/
📺 To view the Phoenix app in a notebook, run `px.active_session().view()`
📖 For more information on how to use Phoenix, check out https://docs.arize.com/phoenix
```

**You are now ready to conduct comparative Root Cause Analysis!**

<div align="left"><figure><img src="../.gitbook/assets/Screenshot 2023-11-06 at 9.43.45 AM.png" alt="" width="563"><figcaption></figcaption></figure></div>

:white\_check\_mark: _Checkpoint B._

_Optional - try the following exercises to familiarize yourself more with Phoenix:_

* [ ] Click into `image_embedding` under the Embeddings listing to enter the UMAP projector
* [ ] Select a point on the time series where there is high drift (hint: as given by Euclidean Distance), and see the datapoints from the time selection being rendered below
* [ ] While colorizing the data by 'Dataset', select the datapoints with the lasso tool where there exists only production data (hint: this is a set of data that has emerged in prod, and is a cause for the increase in drift!)
* [ ] Export the selected cluster from Phoenix
* [ ] Describe in words the process you went through to understand increased drift in your production data

_Discuss your answers in our_ [_community_](https://arize-ai.slack.com/join/shared_invite/zt-2w57bhem8-hq24MB6u7yE_ZF_ilOYSBw#/shared-invite/email)_!_

### Step 7 (Optional): Export data

Once you have identified datapoints of interest, you can export this data directly from the Phoenix app for further analysis, or to incorporate these into downstream model retraining and finetuning flows.

See more on exporting data [here](how-to-inferences/export-your-data.md).

### Step 8 (Optional): Enable production observability with Arize

Once your model is ready for production, you can add Arize to enable production-grade observability. Phoenix works in conjunction with Arize to enable end-to-end model development and observability.

With Arize, you will additionally benefit from:

* Being able to publish and observe your models in real-time as inferences are being served, and/or via direct connectors from your table/storage solution
* Scalable compute to handle billions of predictions
* Ability to set up monitors & alerts
* Production-grade observability
* Integration with Phoenix for model iteration to observability
* Enterprise-grade RBAC and SSO
* Experiment with infinite permutations of model versions and filters

Create your [free account](https://arize.com/join) and see the full suite of [Arize](https://docs.arize.com/arize/) features.

## Where to go from here?

* Read more about Embeddings Analysis [here](use-cases-inferences/embeddings-analysis.md)

***

## Questions?

Join the [Phoenix Slack community](https://join.slack.com/t/arize-ai/shared_invite/zt-1ppbtg5dd-1CYmQO4dWF4zvXFiONTjMg) to ask questions, share findings, provide feedback, and connect with other developers.

---
description: Learn the foundational concepts of the Phoenix API and Application
---

# Phoenix Basics

This section introduces _datasets_ and _schemas,_ the starting concepts needed to use Phoenix.

{% hint style="info" %}
* For comprehensive descriptions of `phoenix.Dataset` and `phoenix.Schema`, see the [API reference](../api/dataset-and-schema.md).
* For tips on creating your own Phoenix datasets and schemas, see the [how-to guide](../how-to/define-your-schema/).
{% endhint %}

## Datasets

A _Phoenix dataset_ is an instance of `phoenix.Dataset` that contains three pieces of information:

* The data itself (a pandas dataframe)
* A [schema](../api/dataset-and-schema.md#phoenix.schema) (a `phoenix.Schema` instance) that describes the [columns](../how-to/define-your-schema/) of your dataframe
* A dataset name that appears in the UI

For example, if you have a dataframe `prod_df` that is described by a schema `prod_schema`, you can define a dataset `prod_ds` with

```python
prod_ds = px.Dataset(prod_df, prod_schema, "production")
```

If you launch Phoenix with this dataset, you will see a dataset named "production" in the UI.

### How many datasets do I need?

> You can run Phoenix with either one or two datasets.

With a single dataset, Phoenix provides insights into model performance and data quality. With two datasets, Phoenix compares your datasets and gives insights into drift in addition to model performance and data quality.

<table data-card-size="large" data-view="cards"><thead><tr><th align="center"></th><th></th></tr></thead><tbody><tr><td align="center"><strong>Use a Single Dataset When:</strong></td><td><ul><li>You have only a single cohort of data, e.g., only training data.</li><li>You care about model performance and data quality, but not drift.</li></ul></td></tr><tr><td align="center"><strong>Use Two Datasets When:</strong></td><td><ul><li>You want to compare cohorts of data, e.g., training vs. production.</li><li>You care about drift in addition to model performance and data quality.</li><li>You have corpus data for information retrieval. See <a href="../how-to/define-your-schema/corpus-data.md">Corpus Data</a>.</li></ul></td></tr></tbody></table>

### Which dataset is which?

> Your reference dataset provides a baseline against which to compare your primary dataset.

To compare two datasets with Phoenix, you must select one dataset as _primary_ and one to serve as a _reference_. As the name suggests, your primary dataset contains the data you care about most, perhaps because your model's performance on this data directly affects your customers or users. Your reference dataset, in contrast, is usually of secondary importance and serves as a baseline against which to compare your primary dataset.

Very often, your primary dataset will contain production data and your reference dataset will contain training data. However, that's not always the case; you can imagine a scenario where you want to check your test set for drift relative to your training data, or use your test set as a baseline against which to compare your production data. When choosing primary and reference datasets, it matters less _where_ your data comes from than _how important_ the data is and _what role_ the data serves relative to your other data.

### Corpus Dataset (Information Retrieval)

The only difference for the [corpus](../how-to/define-your-schema/corpus-data.md) dataset is that it needs a separate schema because it have a different set of columns compared to the model data. See the [schema](phoenix-basics.md#corpus-dataset-information-retrieval) section for more details.

## Schemas

A _Phoenix schema_ is an instance of `phoenix.Schema` that maps the [columns](../how-to/define-your-schema/) of your dataframe to fields that Phoenix expects and understands. Use your schema to tell Phoenix what the data in your dataframe means.

For example, if you have a dataframe containing Fisher's Iris data that looks like this:

| sepal\_length | sepal\_width | petal\_length | petal\_width | target     | prediction |
| ------------- | ------------ | ------------- | ------------ | ---------- | ---------- |
| 7.7           | 3.0          | 6.1           | 2.3          | virginica  | versicolor |
| 5.4           | 3.9          | 1.7           | 0.4          | setosa     | setosa     |
| 6.3           | 3.3          | 4.7           | 1.6          | versicolor | versicolor |
| 6.2           | 3.4          | 5.4           | 2.3          | virginica  | setosa     |
| 5.8           | 2.7          | 5.1           | 1.9          | virginica  | virginica  |

your schema might look like this:

```python
schema = px.Schema(
    feature_column_names=[
        "sepal_length",
        "sepal_width",
        "petal_length",
        "petal_width",
    ],
    actual_label_column_name="target",
    prediction_label_column_name="prediction",
)
```

### How many schemas do I need?

> Usually one, sometimes two.

Each dataset needs a schema. If your primary and reference datasets have the same format, then you only need one schema. For example, if you have dataframes `train_df` and `prod_df` that share an identical format described by a schema named `schema`, then you can define datasets `train_ds` and `prod_ds` with

<pre class="language-python"><code class="lang-python">train_ds = px.Dataset(train_df, schema, "training")
<strong>prod_ds = px.Dataset(prod_df, schema, "production")
</strong></code></pre>

Sometimes, you'll encounter scenarios where the formats of your primary and reference datasets differ. For example, you'll need two schemas if:

* Your production data has timestamps indicating the time at which an inference was made, but your training data does not.
* Your training data has [ground truth](../how-to/define-your-schema/#predictions-and-actuals) (what we call _actuals_ in Phoenix nomenclature), but your production data does not.
* A new version of your model has a differing set of features from a previous version.

In cases like these, you'll need to define two schemas, one for each dataset. For example, if you have dataframes `train_df` and `prod_df` that are described by schemas `train_schema` and `prod_schema`, respectively, then you can define datasets `train_ds` and `prod_ds` with

<pre class="language-python"><code class="lang-python">train_ds = px.Dataset(train_df, train_schema, "training")
<strong>prod_ds = px.Dataset(prod_df, prod_schema, "production")
</strong></code></pre>

#### Schema for Corpus Dataset (Information Retrieval)

A [corpus](../how-to/define-your-schema/corpus-data.md) dataset, containing documents for information retrieval, typically has a different set of columns than those found in the model data from either production or training, and requires a separate schema. Below is an example schema for a corpus dataset with three columns: the `id`, `text`, and `embedding` for each document in the corpus.

{% code fullWidth="false" %}
```python
corpus_schema=Schema(
    id_column_name="id",
    document_column_names=EmbeddingColumnNames(
        vector_column_name="embedding",
        raw_data_column_name="text",
    ),
),
corpus_ds = px.Dataset(corpus_df, corpus_schema)
```
{% endcode %}

## Application

Phoenix runs as an application that can be viewed in a web browser tab or within your notebook as a cell. To launch the app, simply pass one or more datasets into the `launch_app` function:

```python
session = px.launch_app(prod_ds, train_ds)
# or just one dataset
session = px.launch_app(prod_ds)
# or with a corpus dataset
session = px.launch_app(prod_ds, corpus=corpus_ds)
```

The application provide you with a landing page that is populated with your model's `schema` (e.g. the features, tags, predictions, and actuals). This gives you a statistical overview of your data as well as links into the [embeddings details](phoenix-basics.md#embedding-details) views for analysis.&#x20;

<figure><img src="https://storage.googleapis.com/arize-assets/phoenix/assets/images/cc_fraud_home.png" alt="the phoenix home page with an overview of the model"><figcaption><p>The phoenix homepage</p></figcaption></figure>

{% hint style="info" %}
The phoenix homepage is still work in progress. More features coming soon!
{% endhint %}

### Embedding Details

For each [embedding](phoenix-basics.md#embeddings) described in the dataset(s) [schema](../api/dataset-and-schema.md), Phoenix serves a embeddings troubleshooting view to help you identify areas of drift and performance degradation. Let's start with embedding drift.

<figure><img src="https://storage.googleapis.com/arize-assets/phoenix/assets/images/ner_color_by_correctness.png" alt=""><figcaption></figcaption></figure>

### Embedding Drift Over Time

The picture below shows a time series graph of the drift between two groups of vectors –- the primary (typically production) vectors and reference / baseline vectors. Phoenix uses euclidean distance as the primary measure of embedding drift and helps us identify times where your dataset is diverging from a given reference baseline.&#x20;

<figure><img src="https://storage.googleapis.com/arize-assets/phoenix/assets/images/euclidean_distance_timeseries_graph.png" alt="Euclidean distance over time graph"><figcaption><p>Euclidean distance over time</p></figcaption></figure>

Moments of high euclidean distance is an indication that the primary dataset is starting to drift from the reference dataset. As the primary dataset moves further away from the reference (both in angle and in magnitude), the euclidean distance increases as well. For this reason times of high euclidean distance are a good starting point for trying to identify new anomalies and areas of drift.

<figure><img src="https://storage.googleapis.com/arize-assets/phoenix/assets/images/euclidean_distance_vectors.png" alt="Breakdown of euclidean distance - two centroids of points diverging"><figcaption><p>Centroids of the two datasets are used to calculate euclidean and cosine distance</p></figcaption></figure>

{% hint style="info" %}
For an in-depth guide of euclidean distance and embedding drift, check out[ Arze's ML course ](https://arize.com/blog-course/embedding-drift-euclidean-distance/)
{% endhint %}

In phoenix, you can views the drift of a particular embedding in a time series graph at the top of the page. To diagnose the cause of the  drift, click on the graph at different times to view a breakdown of the embeddings at particular time.

<figure><img src="https://storage.googleapis.com/arize-assets/phoenix/assets/images/euclidean_distance_click_cta.png" alt="A time series graph of embeddings over time and a call to action to view details via a click"><figcaption><p>Click on a particular time to view why the inference embeddings are drifting</p></figcaption></figure>

### Clusters

Phoenix automatically breaks up your embeddings into groups of inferences using a clustering algorithm called [HDBSCAN](https://hdbscan.readthedocs.io/en/latest/index.html). This is particularly useful if you are trying to identify areas of your embeddings that are drifting or performing badly.

<div align="left">

<figure><img src="https://storage.googleapis.com/arize-assets/phoenix/assets/images/HDBSCAN_drift_analysis.png" alt=""><figcaption></figcaption></figure>

</div>

When two datasets are used to initialize phoenix, the clusters are automatically ordered by drift. This means that clusters that are suffering from the highest amount of under-sampling (more in the primary dataset than the reference) are bubbled to the top. You can click on these clusters to view the details of the points contained in each cluster. \


### UMAP Point-Cloud

Phoenix projects the embeddings you provided into lower dimensional space (3 dimensions) using a dimension reduction algorithm called [UMAP](https://github.com/lmcinnes/umap) (stands for Uniform Manifold Approximation and Projection).  This lets us understand how your [embeddings have encoded semantic meaning](embeddings.md) in a visually understandable way.\
\
In addition to the point-cloud, another dimension we have at our disposal is color (and in some cases shape). Out of the box phoenix let's you assign colors to the UMAP point-cloud by dimension (features, tags, predictions, actuals), performance (correctness which distinguishes true positives and true negatives from the incorrect predictions), and dataset (to highlight areas of drift). This helps you explore your point-cloud from different perspectives depending on what you are looking for.\


<figure><img src="https://storage.googleapis.com/arize-assets/phoenix/assets/images/umap_color_by.png" alt="Color by dataset vs color by correctness vs color by prediction for a computer vision model"><figcaption><p>Color by dataset vs color by correctness vs color by prediction for a computer vision model</p></figcaption></figure>


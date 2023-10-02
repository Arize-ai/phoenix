---
description: Learn the foundational concepts of the Phoenix API and Application
---

# Inferences - Image/NLP/LLM

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

> You can launch Phoenix with zero, one, or two datasets.

With no datasets, Phoenix runs in the background and collects trace data emitted by your instrumented LLM application. With a single dataset, Phoenix provides insights into model performance and data quality. With two datasets, Phoenix compares your datasets and gives insights into drift in addition to model performance and data quality, or helps you debug your retrieval-augmented generation applications.

<table data-view="cards"><thead><tr><th align="center"></th><th></th></tr></thead><tbody><tr><td align="center"><strong>Use Zero Datasets When:</strong></td><td><ul><li>You want to run Phoenix in the background to collect trace data from your instrumented LLM application.</li></ul></td></tr><tr><td align="center"><strong>Use a Single Dataset When:</strong></td><td><ul><li>You have only a single cohort of data, e.g., only training data.</li><li>You care about model performance and data quality, but not drift.</li></ul></td></tr><tr><td align="center"><strong>Use Two Datasets When:</strong></td><td><ul><li>You want to compare cohorts of data, e.g., training vs. production.</li><li>You care about drift in addition to model performance and data quality.</li><li>You have corpus data for information retrieval. See <a href="../how-to/define-your-schema/corpus-data.md">Corpus Data</a>.</li></ul></td></tr></tbody></table>

### Which dataset is which?

> Your reference dataset provides a baseline against which to compare your primary dataset.

To compare two datasets with Phoenix, you must select one dataset as _primary_ and one to serve as a _reference_. As the name suggests, your primary dataset contains the data you care about most, perhaps because your model's performance on this data directly affects your customers or users. Your reference dataset, in contrast, is usually of secondary importance and serves as a baseline against which to compare your primary dataset.

Very often, your primary dataset will contain production data and your reference dataset will contain training data. However, that's not always the case; you can imagine a scenario where you want to check your test set for drift relative to your training data, or use your test set as a baseline against which to compare your production data. When choosing primary and reference datasets, it matters less _where_ your data comes from than _how important_ the data is and _what role_ the data serves relative to your other data.

### Corpus Dataset (Information Retrieval)

The only difference for the [corpus](../how-to/define-your-schema/corpus-data.md) dataset is that it needs a separate schema because it have a different set of columns compared to the model data. See the [schema](inferences.md#corpus-dataset-information-retrieval) section for more details.

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

The application provide you with a landing page that is populated with your model's `schema` (e.g. the features, tags, predictions, and actuals). This gives you a statistical overview of your data as well as links into the [embeddings details](inferences.md#embedding-details) views for analysis.&#x20;

<figure><img src="https://storage.googleapis.com/arize-assets/phoenix/assets/images/cc_fraud_home.png" alt="the phoenix home page with an overview of the model"><figcaption><p>The phoenix homepage</p></figcaption></figure>

---
description: Learn the foundational concepts of the Phoenix API
---

# Phoenix Basics

This section introduces _datasets_ and _schemas,_ the starting concepts needed to use Phoenix.

{% hint style="info" %}
* For comprehensive descriptions of `phoenix.Dataset` and `phoenix.Schema`, see the [API reference](../reference/api/).                                             &#x20;
* For code examples, see the [dataset](../how-to/define-your-dataset-s.md) and [schema](../how-to/define-your-schema.md) how-to guides.
{% endhint %}

## Datasets

A _Phoenix dataset_ is an instance of `phoenix.Dataset` that contains three pieces of information:

* The data itself (a Pandas DataFrame)
* A schema (a `phoenix.Schema` instance) that describes the columns of your DataFrame
* A dataset name that appears in the UI

For example, if you have a DataFrame `prod_df` that is described by a schema `prod_schema`, you can define a dataset `prod_ds` with

```python
prod_ds = px.Dataset(prod_df, prod_schema, "production")
```

If you launch Phoenix with this dataset, you will see a dataset named "production" in the UI.

### How many datasets do I need?

> You can run Phoenix with either one or two datasets.

With a single dataset, Phoenix provides insights into model performance and data quality. With two datasets, Phoenix compares your datasets and gives insights into drift in addition to model performance and data quality.

<table data-card-size="large" data-view="cards"><thead><tr><th align="center"></th><th></th></tr></thead><tbody><tr><td align="center"><strong>Use a Single Dataset When:</strong></td><td><ul><li>You have only a single cohort of data, e.g., only training data.</li><li>You care about model performance and data quality, but not drift.</li></ul></td></tr><tr><td align="center"><strong>Use Two Datasets When:</strong></td><td><ul><li>You want to compare cohorts of data, e.g., training vs. production.</li><li>You care about drift in addition to model performance and data quality.</li></ul></td></tr></tbody></table>

### Which dataset is which?

> Your baseline dataset provides a reference against which to compare your primary dataset.

To compare two datasets with Phoenix, you must select one dataset as _primary_ and one to serve as a _baseline_. As the name suggests, your primary dataset contains the data you care about most, perhaps because your model's performance on this data directly affects your customers or users. Your baseline dataset, in contrast, is usually of secondary importance and serves as a reference against which to compare your primary dataset.

Very often, your primary dataset will contain production data and your baseline dataset will contain training data. However, that's not always the case; you can imagine a scenario where you want to check your test set for drift relative to your training data, or use your test set as a baseline against which to compare your production data. When choosing primary and baseline datasets, it matters less _where_ your data comes from than _how important_ the data is and _what role_ the data serves relative to your other data.

## Schemas

A _Phoenix schema_ is an instance of `phoenix.Schema` that maps the columns of your DataFrame to fields that Phoenix expects and understands. Use your schema to tell Phoenix what the data in your DataFrame means.

For example, if you have a DataFrame that looks like this:

you might create a schema that look like this:

### How many schemas do I need?

> Usually one, sometimes two.

Each dataset needs a schema. If your primary and baseline datasets have the same format, then you only need one schema. For example, if you have DataFrames `train_df` and `prod_df` that share an identical format described by a schema named `schema`, then you can define datasets `train_ds` and `prod_ds` with

<pre class="language-python"><code class="lang-python">train_ds = px.Dataset(train_df, schema, "training")
<strong>prod_ds = px.Dataset(prod_df, schema, "production")
</strong></code></pre>

Occasionally, however, you'll encounter scenarios where the formats of your primary and baseline datasets differ.

---
description: >-
  How to define your dataset(s), launch a session, open the UI in your notebook
  or browser, and close your session when you're done
---

# Manage the App

## Define Your Dataset(s)

{% hint style="info" %}
For a conceptual overview of datasets, including an explanation of when to use a single dataset vs. primary and reference datasets, see [Phoenix Basics](../quickstart/phoenix-inferences/inferences.md#datasets).
{% endhint %}

To define a dataset, you must load your data into a pandas dataframe and [create a matching schema](define-your-schema/). If you have a dataframe `prim_df` and a matching `prim_schema`, you can define a dataset named "primary" with

```python
prim_ds = px.Dataset(prim_df, prim_schema, "primary")
```

If you additionally have a dataframe `ref_df` and a matching `ref_schema`, you can define a dataset named "reference" with

```
ref_ds = px.Dataset(ref_df, ref_schema, "reference")
```

See [Corpus Data](define-your-schema/corpus-data.md) if you have corpus data for an Information Retrieval use case.

## Launch the App

Use `phoenix.launch_app` to start your Phoenix session in the background. You can launch Phoenix with zero, one, or two datasets.

<table data-card-size="large" data-view="cards"><thead><tr><th align="center"></th><th></th><th></th></tr></thead><tbody><tr><td align="center"><strong>No Dataset</strong></td><td><pre class="language-python"><code class="lang-python">session = px.launch_app()
</code></pre></td><td><ul><li>Run Phoenix in the background to collect OpenInference traces emitted by your instrumented LLM application.</li></ul></td></tr><tr><td align="center"><strong>Single Dataset</strong></td><td><pre class="language-python"><code class="lang-python">session = px.launch_app(ds)
</code></pre></td><td><ul><li>Analyze a single cohort of data, e.g., only training data.</li><li>Check model performance and data quality, but not drift.</li></ul></td></tr><tr><td align="center"><strong>Primary and Reference Datasets</strong></td><td><pre class="language-python" data-overflow="wrap"><code class="lang-python">session = px.launch_app(prim_ds, ref_ds)
</code></pre></td><td><ul><li>Compare cohorts of data, e.g., training vs. production.</li><li>Analyze drift in addition to model performance and data quality.</li></ul></td></tr><tr><td align="center"><strong>Primary and</strong> <a href="define-your-schema/corpus-data.md"><strong>Corpus</strong></a> <strong>Datasets</strong></td><td><pre class="language-python" data-overflow="wrap"><code class="lang-python">session = px.launch_app(query_ds, corpus=corpus_ds)
</code></pre></td><td><ul><li>Compare a query dataset to a corpus dataset to analyze your retrieval-augmented generation applications.</li></ul></td></tr></tbody></table>

## Open the UI

You can view and interact with the Phoenix UI either directly in your notebook or in a separate browser tab or window.

{% tabs %}
{% tab title="In the Browser" %}
In a notebook cell, run

```python
session.url
```

Copy and paste the output URL into a new browser tab or window.

{% hint style="info" %}
Browser-based sessions are supported in both local Jupyter environments and Colab.
{% endhint %}
{% endtab %}

{% tab title="In Your Notebook" %}
In a notebook cell, run

```python
session.view()
```

The Phoenix UI will appear in an inline frame in the cell output.

{% hint style="info" %}
The height of the window can be adjusted by passing a `height` parameter, e.g., `session.view(height=1200)`. Defaults to 1000 pixels.
{% endhint %}
{% endtab %}
{% endtabs %}

## Close the App

When you're done using Phoenix, gracefully shut down your running background session with

```python
px.close_app()
```

If you need to terminate the port connection entirely, then&#x20;

```
lsof -t -i tcp:6006 | xargs kill -9
```


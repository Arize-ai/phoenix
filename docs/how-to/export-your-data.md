---
description: How to export your data for labeling, evaluation, or fine-tuning
---

# Export Your Data

Phoenix is designed to be a pre-production tool that can be used to find interesting or problematic data that can be used for various use-cases:

* A subset of production data for re-labeling and training
* A subset of data for fine-tuning an LLM
* A set of [traces](../tracing/overview.md) to run [LLM Evals](../evaluation/overview.md) with or to share with a teammate

## Exporting Traces

The easiest way to gather traces that have been collected by Phoenix is to directly pull a dataframe of the traces from your Phoenix `session` object.

```python
px.Client().get_spans_dataframe('span_kind == "RETRIEVER"')
```

Notice that the `get_spans_dataframe` method supports a Python expression as an optional `str` parameter so you can filter down your data to specific traces you care about. For full details, consult the [Client](../api/client.md) API docs.

## Exporting Embeddings

Embeddings can be extremely useful for fine-tuning. There are two ways to export your embeddings from the Phoenix UI.

### Export Selected Clusters

To export a cluster (either selected via the lasso tool or via a the cluster list on the right hand panel), click on the export button on the top left of the bottom slide-out.

### Export All Clusters

To export all clusters of embeddings as a single dataframe (labeled by cluster), click the `...` icon on the top right of the screen and click export. Your data will be available either as a Parquet file or is available back in your notebook via your [session](../api/session.md#attributes) as a dataframe.

```python
session = px.active_session()
session.exports[-1].dataframe
```

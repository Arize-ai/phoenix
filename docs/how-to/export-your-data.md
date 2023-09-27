---
description: How to export your data for fine-tuning, retraining, or storage
---

# Export Your Data

Phoenix is designed to be a pre-production tool that can be used to find interesting or problematic data that can be used for various use-cases:

* A sub-set of production data for re-labeling and training
* A sub-set of data for fine-tuning an LLM
* A set of [traces](../concepts/langchain-and-llamaindex-traces.md) to run [LLM Evals](../concepts/llm-evals.md) with or to share with a teammate.

## Exporting Traces

The easiest way to gather traces that have been collected by phoenix is to directly pull a DataFrame of the traces from the phoenix session.

```python
px.active_session().get_spans_dataframe('span_kind == "RETRIEVER"')
```

Notice that the `get_spans_dataframe` method supports a python expression as an optional `str` param so you can filter down the data to specific parts of your traces. For full details, consult the API docs for [session](../api/session.md).

## Exporting Embeddings

Embeddings can be extremely useful for fine-tuning. There are two ways to export your embeddings from the phoenix UI.

### Export Selected Clusters

To export a cluster (either selected via the lasso tool or via a the cluster list on the right hand panel), click on the export button on the top left of the bottom slide-out.

### Export All Clusters

To export all clusters of embeddings as a single DataFrame (labeled by cluster), click the `...` icon on the top right of the screen and click export. Your data will be available either as a parquet file or is available back in your notebook via your [session](../api/session.md#attributes) as a DataFrame.

```python
session = px.active_session()
session.exports[-1].dataframe
```

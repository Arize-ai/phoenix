---
description: How to export your data for labeling, evaluation, or fine-tuning
---

# Export Data

## Exporting Embeddings

Embeddings can be extremely useful for fine-tuning. There are two ways to export your embeddings from the Phoenix UI.

## Export Selected Clusters

To export a cluster (either selected via the lasso tool or via a the cluster list on the right hand panel), click on the export button on the top left of the bottom slide-out.

## Export All Clusters

To export all clusters of embeddings as a single dataframe (labeled by cluster), click the `...` icon on the top right of the screen and click export. Your data will be available either as a Parquet file or is available back in your notebook via your [session](../api/session.md#attributes) as a dataframe.

```python
session = px.active_session()
session.exports[-1].dataframe
```

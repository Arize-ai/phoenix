---
description: A detailed description of the phoenix.launch_app API
---

# phoenix.launch\_app

## function [phoenix.launch\_app](https://github.com/Arize-ai/phoenix/blob/main/src/phoenix/session/session.py)

**(**\
&#x20;       **primary:** [phoenix.Dataset](../datasets-and-schemas/phoenix.dataset.md),\
&#x20;       **reference:** Optional\[[phoenix.Dataset](../datasets-and-schemas/phoenix.dataset.md)] = None,\
**)  ->** [phoenix.Session](phoenix.session.md)

Launches and returns a new Phoenix session.

This function accepts one or two [phoenix.Dataset](../datasets-and-schemas/phoenix.dataset.md) instances as arguments. If the app is launched with a single dataset, Phoenix provides model performance and data quality metrics, but not drift metrics. If the app is launched with two datasets, Phoenix provides drift metrics in addition to model performance and data quality metrics. When two datasets are provided, the reference dataset serves as a baseline against which to compare the primary dataset. Common examples of primary and reference datasets include production vs. training or challenger vs. champion.

### Parameters

* **primary** ([phoenix.Dataset](../datasets-and-schemas/phoenix.dataset.md)): The dataset that is of primary interest as the subject of investigation or evaluation.
* **reference** (Optional\[[phoenix.Dataset](../datasets-and-schemas/phoenix.dataset.md)]): If provided, the reference dataset serves as a baseline against which to compare the primary dataset.

### Returns

The newly launched session as an instance of [phoenix.Session](phoenix.session.md).

### Usage

Launch Phoenix with primary and reference datasets `prim_ds` and `ref_ds`, both instances of [phoenix.Dataset](../datasets-and-schemas/phoenix.dataset.md), with

```python
session = px.launch_app(prim_ds, ref_ds)
```

Alternatively, launch Phoenix with a single dataset `ds`, an instance of [phoenix.Dataset](../datasets-and-schemas/phoenix.dataset.md), with

```python
session = px.launch_app(ds)
```

Then `session` is an instance of [phoenix.Session](phoenix.session.md) that can be used to open the Phoenix UI in an inline frame within the notebook or in a separate browser tab or window.

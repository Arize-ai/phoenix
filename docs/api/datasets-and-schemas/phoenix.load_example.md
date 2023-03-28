---
description: A detailed description of the phoenix.load_example API
---

# phoenix.load\_example

## function [phoenix.load\_example](https://github.com/Arize-ai/phoenix/blob/main/src/phoenix/datasets/fixtures.py)

**(**\
&#x20;       **use\_case:** str,\
**)  ->**  [phoenix.ExampleDatasets](phoenix.exampledatasets.md)

Downloads example datasets that enable users to quickly launch the app with concrete use-cases.

### Parameters

* **use\_case** (str): Name of the example use-case for which to download datasets. Valid values include:
  * "sentiment\_classification\_language\_drift"
  * "fashion\_mnist"
  * "ner\_token\_drift"
  * "credit\_card\_fraud"
  * "click\_through\_rate"

### Returns

A [phoenix.ExampleDatasets](phoenix.exampledatasets.md) instance containing a pair of primary and reference datasets.

### Usage

In a notebook cell, inspect the docstring of `phoenix.load_example` to see a list of supported examples with

```python
px.load_example?
```

Select an example from the list. Let's use "sentiment\_classification\_language\_drift" for the sake of concreteness. Run

```python
datasets = px.load_example("sentiment_classification_language_drift")
```

to download the data for this particular example. Now `datasets` is an instance of [phoenix.ExampleDatasets](phoenix.exampledatasets.md) with `primary` and `reference` attributes. Launch Phoenix with

```python
session = px.launch_app(datasets.primary, datasets.reference)
```

Then `session` is an instance of [phoenix.Session](../sessions/phoenix.session.md) that can be used to open the Phoenix UI in an inline frame within the notebook or in a separate browser tab or window.

---
description: A detailed description of the phoenix.ExampleDatasets API
---

# phoenix.ExampleDatasets

## class [phoenix.ExampleDatasets](https://github.com/Arize-ai/phoenix/blob/main/src/phoenix/datasets/fixtures.py)

**(**\
&#x20;       **primary:** [phoenix.Dataset](phoenix.dataset.md),\
&#x20;       **reference:** [phoenix.Dataset](phoenix.dataset.md),\
**)**

A dataclass containing a pair of primary and reference datasets corresponding to a particular use-case.

### Parameters

* **primary** ([phoenix.Dataset](phoenix.dataset.md)): The primary dataset corresponding to a use-case.
* **reference** ([phoenix.Dataset](phoenix.dataset.md)): The reference dataset corresponding to a use-case.

### Notes

Phoenix users should not instantiate their own instances of `phoenix.ExampleDatasets`. They interact with this class only when downloading datasets via [phoenix.load\_examples](phoenix.load\_example.md).

### Usage

See the API reference for [phoenix.load\_example](phoenix.load\_example.md) for an example.

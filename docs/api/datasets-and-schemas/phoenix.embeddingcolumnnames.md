---
description: A detailed description of the phoenix.EmbeddingColumnNames API
---

# phoenix.EmbeddingColumnNames

## class [phoenix.EmbeddingColumnNames](https://github.com/Arize-ai/phoenix/blob/main/src/phoenix/datasets/schema.py)

**(**\
&#x20;       **vector\_column\_name:** str,\
&#x20;       **raw\_data\_column\_name:** Optional\[str] = None,\
&#x20;       **link\_to\_data\_column\_name:** Optional\[str] = None,\
**)**

A dataclass that associates one or more columns of a DataFrame with an embedding feature. Instances of this class are only used as values in a dictionary passed to the **embedding\_feature\_column\_names** field of [phoenix.Schema](phoenix.schema.md).

### Parameters

* **vector\_column\_name** (str): The name of the DataFrame column containing the embedding vector data. Each entry in the column must be a list, one-dimensional Numpy array, or Pandas Series containing numeric values (floats or ints) and must have equal length to all the other entries in the column.
* **raw\_data\_column\_name** (Optional\[str]): The name of the DataFrame column containing the raw text associated with an embedding feature, if such a column exists. This field is used when an embedding feature describes a piece of text, for example, in the context of NLP.
* **link\_to\_data\_column\_name** (Optional\[str]): The name of the DataFrame column containing links to images associated with an embedding feature, if such a column exists. This field is used when an embedding feature describes an image, for example, in the context of computer vision.

### Notes

See [here](../../how-to/define-your-schema.md#local-images) for recommendations on handling local image files.

### Usage

See the API reference for [phoenix.Schema](phoenix.schema.md#examples) for examples.

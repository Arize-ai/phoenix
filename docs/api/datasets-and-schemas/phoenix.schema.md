---
description: A detailed description of the phoenix.Schema API
---

# phoenix.Schema

## class [phoenix.Schema](http://localhost:5000/s/-MWfe69uySLOZNXfwq4w/security-news/2021-12-15-cve-44228)

**(**\
&#x20;       **prediction\_id\_column\_name:** Optional\[str] = None,\
&#x20;       **timestamp\_column\_name:** Optional\[str] = None,\
&#x20;       **feature\_column\_names:** Optional\[List\[str]] = None,\
&#x20;       **tag\_column\_names:** Optional\[List\[str]] = None,\
&#x20;       **prediction\_label\_column\_name:** Optional\[str] = None,\
&#x20;       **prediction\_score\_column\_name:** Optional\[str] = None,\
&#x20;       **actual\_label\_column\_name:** Optional\[str] = None,\
&#x20;       **actual\_score\_column\_name:** Optional\[str] = None,\
&#x20;       **embedding\_feature\_column\_names:** Optional\[Dict\[str, [phoenix.EmbeddingColumnNames](phoenix.embeddingcolumnnames.md)]] = None,\
&#x20;       **excludes:** Optional\[List\[str]] = None,\
**)**

A dataclass that assigns the columns of a Pandas DataFrame to the appropriate model dimensions (predictions, actuals, features, etc.). Each column of the DataFrame should appear in the corresponding schema at most once.

### Parameters

* **prediction\_id\_column\_name** __ (Optional\[str]): The name of the DataFrame's prediction ID column, if one exists. Prediction IDs are strings that uniquely identify each record in a Phoenix dataset (equivalently, each row in the DataFrame). If no prediction ID column name is provided, Phoenix will automatically generate unique UUIDs for each record of the dataset upon [phoenix.Dataset](phoenix.dataset.md) initialization.
* **timestamp\_column\_name** (Optional\[str]): The name of the DataFrame's timestamp column, if one exists. Timestamp columns must be Pandas Series with numeric or datetime dtypes.
  * If the timestamp column has numeric dtype (int or float), the entries of the column are interpreted as Unix timestamps, i.e., the number of seconds since midnight on January 1st, 1970.
  * If the column has datetime dtype and contains timezone-naive timestamps, Phoenix assumes those timestamps belong to the UTC timezone.
  * If the column has datetime dtype and contains timezone-aware timestamps, those timestamps are converted to UTC.
  * If no timestamp column is provided, each record in the dataset is assigned the current timestamp upon [phoenix.Dataset](phoenix.dataset.md) initialization.
* **feature\_column\_names** (Optional\[List\[str]]): The names of the DataFrame's feature columns, if any exist. If no feature column names are provided, all DataFrame column names that are not included elsewhere in the schema and are not explicitly excluded in the list of **excludes** are assumed to be features.
* **tag\_column\_names** (Optional\[List\[str]]): The names of the DataFrame's tag columns, if any exist. Tags, like features, are attributes that can be used for filtering records of the dataset while using the app. Unlike features, tags are not model inputs and are not used for computing metrics.
* **prediction\_label\_column\_name** (Optional\[str]): The name of the DataFrame's predicted label column, if one exists. Predicted labels are used for classification problems with categorical model output.
* **prediction\_score\_column\_name** (Optional\[str]): The name of the DataFrame's predicted score column, if one exists. Predicted scores are used for regression problems with continuous numerical model output.
* **actual\_label\_column\_name** (Optional\[str]): The name of the DataFrame's actual label column, if one exists. Actual (i.e., ground truth) labels are used for classification problems with categorical model output.
* **actual\_score\_column\_name** (Optional\[str]): The name of the DataFrame's actual score column, if one exists. Actual (i.e., ground truth) scores are used for regression problems with continuous numerical output.
* **embedding\_feature\_column\_names** (Optional\[Dict\[str, [phoenix.EmbeddingColumnNames](phoenix.embeddingcolumnnames.md)]]): A dictionary mapping the name of each embedding feature to an instance of [phoenix.EmbeddingColumnNames](phoenix.embeddingcolumnnames.md) if any embedding features exist, otherwise, None. Each instance of [phoenix.EmbeddingColumnNames](phoenix.embeddingcolumnnames.md) associates one or more DataFrame columns containing vector data, image links, or text with the same embedding feature. Note that the keys of the dictionary are user-specified names that appear in the Phoenix UI and do not refer to columns of the DataFrame.
* **excludes** (Optional\[List\[str]]): The names of the DataFrame columns to be excluded from the implicitly inferred list of feature column names. This field should only be used for implicit feature discovery, i.e., when **feature\_column\_names** is unused and the DataFrame contains feature columns not explicitly included in the schema.

### Usage

TODO: Add examples

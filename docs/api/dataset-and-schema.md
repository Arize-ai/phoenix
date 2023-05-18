---
description: >-
  Detailed descriptions of classes and methods related to Phoenix datasets and
  schemas
---

# Dataset and Schema

## phoenix.Dataset

```python
class Dataset(
    dataframe: pandas.DataFrame,
    schema: Schema,
    name: Optional[str] = None,
)
```

A dataset containing a split or cohort of data to be analyzed independently or compared to another cohort. Common examples include training, validation, test, or production datasets.

**\[**[**source**](https://github.com/Arize-ai/phoenix/blob/main/src/phoenix/datasets/dataset.py)**]**

### Parameters

* **dataframe** (pandas.DataFrame): The data to be analyzed or compared.
* **schema** ([phoenix.Schema](dataset-and-schema.md#phoenix.schema)): A schema that assigns the columns of the dataframe to the appropriate model dimensions (features, predictions, actuals, etc.).
* **name** (Optional\[str]): The name used to identify the dataset in the application. If not provided, a random name will be generated.

### Methods

* **head**(num\_rows: Optional\[int] = 5) -> pandas.DataFrame\
  \
  Returns the first `num_rows` rows of the dataset's dataframe. This method is useful for inspecting the dataset's underlying dataframe to ensure it has the expected format and content.\
  \
  **Parameters**
  * **num\_rows** (int): The number of rows in the returned dataframe.

### Attributes

* **dataframe** (pandas.DataFrame): The pandas dataframe of the dataset.
* **schema** ([phoenix.Schema](dataset-and-schema.md#phoenix.schema)): The schema of the dataset.
* **name** (str): The name of the dataset.

{% hint style="info" %}
The input dataframe and schema are lightly processed during dataset initialization and are not necessarily identical to the corresponding `dataframe` and `schema` attributes.
{% endhint %}

### Usage

Define a dataset `ds` from a pandas dataframe `df` and a schema object `schema` by running

```python
ds = px.Dataset(df, schema)
```

Alternatively, provide a name for the dataset that will appear in the application:

```python
ds = px.Dataset(df, schema, name="training")
```

`ds` is then passed as the `primary` or `reference` argument to [phoenix.launch\_app](session.md#phoenix.launch\_app).

## phoenix.Schema

```python
class Schema(
    prediction_id_column_name: Optional[str] = None,
    timestamp_column_name: Optional[str] = None,
    feature_column_names: Optional[List[str]] = None,
    tag_column_names: Optional[List[str]] = None,
    prediction_label_column_name: Optional[str] = None,
    prediction_score_column_name: Optional[str] = None,
    actual_label_column_name: Optional[str] = None,
    actual_score_column_name: Optional[str] = None,
    prompt_column_names: Optional[EmbeddingColumnNames] = None
    response_column_names: Optional[EmbeddingColumnNames] = None
    embedding_feature_column_names: Optional[Dict[str, EmbeddingColumnNames]] = None,
    excluded_column_names: Optional[List[str]] = None,
)
```

A dataclass that assigns the columns of a pandas dataframe to the appropriate model dimensions (predictions, actuals, features, etc.). Each column of the dataframe should appear in the corresponding schema at most once.

**\[**[**source**](https://github.com/Arize-ai/phoenix/blob/main/src/phoenix/datasets/schema.py)**]**

### Parameters

* **prediction\_id\_column\_name** \_\_ (Optional\[str]): The name of the dataframe's prediction ID column, if one exists. Prediction IDs are strings that uniquely identify each record in a Phoenix dataset (equivalently, each row in the dataframe). If no prediction ID column name is provided, Phoenix will automatically generate unique UUIDs for each record of the dataset upon [phoenix.Dataset](dataset-and-schema.md#phoenix.dataset) initialization.
* **timestamp\_column\_name** (Optional\[str]): The name of the dataframe's timestamp column, if one exists. Timestamp columns must be pandas Series with numeric, datetime or object dtypes.
  * If the timestamp column has numeric dtype (`int` or `float`), the entries of the column are interpreted as Unix timestamps, i.e., the number of seconds since midnight on January 1st, 1970.
  * If the column has datetime dtype and contains timezone-naive timestamps, Phoenix assumes those timestamps belong to the UTC timezone.
  * If the column has datetime dtype and contains timezone-aware timestamps, those timestamps are converted to UTC.
  * If the column has object dtype having ISO8601 formatted timestamp strings, those entries are converted to datetime dtype timestamps having UTC timezone; if timezone-naive(assumed as UTC) or timezone-aware(converted to UTC).
  * If no timestamp column is provided, each record in the dataset is assigned the current timestamp upon [phoenix.Dataset](dataset-and-schema.md#phoenix.dataset) initialization.
* **feature\_column\_names** (Optional\[List\[str]]): The names of the dataframe's feature columns, if any exist. If no feature column names are provided, all dataframe column names that are not included elsewhere in the schema and are not explicitly excluded in `excluded_column_names` are assumed to be features.
* **tag\_column\_names** (Optional\[List\[str]]): The names of the dataframe's tag columns, if any exist. Tags, like features, are attributes that can be used for filtering records of the dataset while using the app. Unlike features, tags are not model inputs and are not used for computing metrics.
* **prediction\_label\_column\_name** (Optional\[str]): The name of the dataframe's predicted label column, if one exists. Predicted labels are used for classification problems with categorical model output.
* **prediction\_score\_column\_name** (Optional\[str]): The name of the dataframe's predicted score column, if one exists. Predicted scores are used for regression problems with continuous numerical model output.
* **actual\_label\_column\_name** (Optional\[str]): The name of the dataframe's actual label column, if one exists. Actual (i.e., ground truth) labels are used for classification problems with categorical model output.
* **actual\_score\_column\_name** (Optional\[str]): The name of the dataframe's actual score column, if one exists. Actual (i.e., ground truth) scores are used for regression problems with continuous numerical output.
* **prompt\_column\_names** (Optional\[[phoenix.EmbeddingColumnNames](dataset-and-schema.md#phoenix.embeddingcolumnnames)]): An instance of [phoenix.EmbeddingColumnNames](dataset-and-schema.md#phoenix.embeddingcolumnnames) delineating the column names of an [LLM](../concepts/llm-observability.md) model's _prompt_ embedding vector, _prompt_ text, and optionally links to external resources.
* **response\_column\_names** (Optional\[[phoenix.EmbeddingColumnNames](dataset-and-schema.md#phoenix.embeddingcolumnnames)]): An instance of [phoenix.EmbeddingColumnNames](dataset-and-schema.md#phoenix.embeddingcolumnnames) delineating the column names of an [LLM](../concepts/llm-observability.md) model's _response_ embedding vector, _response_ text, and optionally links to external resources.
* **embedding\_feature\_column\_names** (Optional\[Dict\[str, [phoenix.EmbeddingColumnNames](dataset-and-schema.md#phoenix.embeddingcolumnnames)]]): A dictionary mapping the name of each embedding feature to an instance of [phoenix.EmbeddingColumnNames](dataset-and-schema.md#phoenix.embeddingcolumnnames) if any embedding features exist, otherwise, None. Each instance of [phoenix.EmbeddingColumnNames](dataset-and-schema.md#phoenix.embeddingcolumnnames) associates one or more dataframe columns containing vector data, image links, or text with the same embedding feature. Note that the keys of the dictionary are user-specified names that appear in the Phoenix UI and do not refer to columns of the dataframe.
* **excluded\_column\_names** (Optional\[List\[str]]): The names of the dataframe columns to be excluded from the implicitly inferred list of feature column names. This field should only be used for implicit feature discovery, i.e., when `feature_column_names` is unused and the dataframe contains feature columns not explicitly included in the schema.

### Usage

See the guide on how to [create your own dataset](../how-to/define-your-schema.md) for examples.

## phoenix.EmbeddingColumnNames

```python
class EmbeddingColumnNames(
    vector_column_name: str,
    raw_data_column_name: Optional[str] = None,
    link_to_data_column_name: Optional[str] = None,
)
```

A dataclass that associates one or more columns of a dataframe with an [embedding](../concepts/embeddings.md) feature. Instances of this class are only used as values in a dictionary passed to the `embedding_feature_column_names` field of [phoenix.Schema](dataset-and-schema.md#phoenix.schema).

**\[**[**source**](https://github.com/Arize-ai/phoenix/blob/main/src/phoenix/datasets/schema.py)**]**

### Parameters

* **vector\_column\_name** (str): The name of the dataframe column containing the embedding vector data. Each entry in the column must be a list, one-dimensional NumPy array, or pandas Series containing numeric values (floats or ints) and must have equal length to all the other entries in the column.
* **raw\_data\_column\_name** (Optional\[str]): The name of the dataframe column containing the raw text associated with an embedding feature, if such a column exists. This field is used when an embedding feature describes a piece of text, for example, in the context of NLP.
* **link\_to\_data\_column\_name** (Optional\[str]): The name of the dataframe column containing links to images associated with an embedding feature, if such a column exists. This field is used when an embedding feature describes an image, for example, in the context of computer vision.

{% hint style="info" %}
See [here](../how-to/define-your-schema.md#local-images) for recommendations on handling local image files.
{% endhint %}

### Usage

See the guide on how to [create embedding features ](../how-to/define-your-schema.md#embedding-features)for examples.

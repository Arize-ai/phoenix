# #⃣ phoenix.Dataset

The `Dataset` class represents a dataset for analysis using the phoenix app. It can be used to construct a Phoenix session via `px.launch_app`.

### Dataset

```python
class Dataset:
    def __init__(
        self,
        dataframe: DataFrame,
        schema: Schema,
        name: Optional[str] = None,
        persist_to_disc: bool = True,
    )
```

#### Parameters

* `dataframe`: A pandas DataFrame containing the data to analyze.
* `schema`: A Phoenix `Schema` object that maps dataframe columns to the appropriate model inference dimensions (features, predictions, actuals).
* `name` (optional): The name of the dataset. If not provided, a random name will be generated. It is helpful for identifying the dataset in the application.
* `persist_to_disc` (optional): A boolean value to indicate if the dataset should be persisted to disk. Default value is `True`.

#### Returns

* A `Dataset` object that can be used in a Phoenix session.

#### Example

```python
primary_dataset = px.Dataset(dataframe=production_dataframe, schema=schema, name="primary")
```

### Properties

* `start_time`: Returns the datetime of the earliest inference in the dataset.
* `end_time`: Returns the datetime of the latest inference in the dataset.
* `dataframe`: Returns the underlying pandas DataFrame of the dataset.
* `schema`: Returns the Schema object associated with the dataset.
* `name`: Returns the name of the dataset.
* `is_persisted`: Returns a boolean value indicating if the dataset has been persisted to disk.
* `directory`: Returns the directory under which the dataset metadata is stored.

### Methods

* `head(num_rows: Optional[int] = 5)`: Returns the first `num_rows` rows of the dataframe. Default value is 5.
* `get_column(col_name: str)`: Returns the specified column from the dataframe.
* `sample(num: int)`: Returns a new `Dataset` object containing a random sample of `num` rows from the original dataset.
* `get_prediction_id_column()`: Returns the prediction ID column from the dataframe.
* `get_prediction_label_column()`: Returns the prediction label column from the dataframe.
* `get_prediction_score_column()`: Returns the prediction score column from the dataframe.
* `get_actual_label_column()`: Returns the actual label column from the dataframe.
* `get_actual_score_column()`: Returns the actual score column from the dataframe.
* `get_embedding_vector_column(embedding_feature_name: str)`: Returns the embedding vector column for the given `embedding_feature_name`.
* `get_embedding_raw_data_column(embedding_feature_name: str)`: Returns the embedding raw data column for the given `embedding_feature_name`.
* `get_embedding_link_to_data_column(embedding_feature_name: str)`: Returns the embedding link to data column for the given `embedding_feature_name`.
* `get_timestamp_column()`: Returns the timestamp column from the dataframe.
* `from_dataframe(dataframe: DataFrame, schema: Schema, name: Optional[str] = None)`: Creates a new `Dataset` object using the given dataframe, schema, and optional name.
* `from_name(name: str)`: Retrieves a dataset by name from the file system.
* `to_disc()`: Writes the data and schema to disk.

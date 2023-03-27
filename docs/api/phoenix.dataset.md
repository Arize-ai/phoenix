# #⃣ phoenix.Dataset

The `Dataset` class represents a dataset for analysis using the phoenix app. It can be used to construct a Phoenix session via `px.launch_app`.

### Dataset

```python
class Dataset:
    def __init__(
        self,
        dataframe: DataFrame,
        schema: Schema,
        name: Optional[str] = None
    )
```

#### Parameters

* `dataframe`: A pandas DataFrame containing the data to analyze.
* `schema`: A Phoenix `Schema` object that maps dataframe columns to the appropriate model inference dimensions (features, predictions, actuals).
* `name` (optional): The name of the dataset. If not provided, a random name will be generated. It is helpful for identifying the dataset in the application.

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

### Methods

* `head(num_rows: Optional[int] = 5)`: Returns the first `num_rows` rows of the dataframe. Default value is 5.

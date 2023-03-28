---
description: A detailed description of the phoenix.Dataset API
---

# phoenix.Dataset

## class [phoenix.Dataset](https://github.com/Arize-ai/phoenix/blob/main/src/phoenix/datasets/dataset.py)

**(**\
&#x20;       **dataframe:** pandas.DataFrame,\
&#x20;       **schema:** [phoenix.Schema](phoenix.schema.md),\
&#x20;       **name:** Optional\[str] = None,\
**)**

A dataset containing a split or cohort of data to be analyzed independently or compared to another cohort. Common examples include training, validation, test, or production datasets.

### Parameters

* **dataframe** (pandas.DataFrame): The data to be analyzed or compared.
* **schema** ([phoenix.Schema](phoenix.schema.md)): A schema that assigns the columns of the DataFrame to the appropriate model dimensions (features, predictions, actuals, etc.).
* **name** (Optional\[str]): The name used to identify the dataset in the application. If not provided, a random name will be generated.

### Methods

* **head(**\
  &#x20;       **num\_rows:** Optional\[int] = 5,\
  **)  ->**  pandas.DataFrame\
  \
  Returns the first **num\_rows** rows of the dataset's DataFrame. This method is useful for inspecting the dataset's underlying DataFrame to ensure it has the expected format and content.\
  \
  **Parameters**
  * **num\_rows** (int): The number of rows in the returned DataFrame.

### Attributes

* **dataframe** (pandas.DataFrame): The Pandas DataFrame of the dataset.
* **schema** ([phoenix.Schema](phoenix.schema.md)): The schema of the dataset.
* **name** (str): The name of the dataset.

### Notes

The input DataFrame and schema are lightly processed during dataset initialization and are not necessarily identical to the corresponding **dataframe** and **schema** attributes.

### Usage

TODO: Add examples

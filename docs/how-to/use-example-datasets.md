---
description: Quickly explore Phoenix with concrete examples
---

# Use Example Datasets

Phoenix ships with a collection of example datasets so you can quickly try out the app on concrete use-cases. This guide shows you how to download, inspect, and launch the app with example datasets.

## View Available Datasets

To see a list of datasets available for download, run

```python
px.load_example?
```

This displays the docstring for the `px.load_example` function, which contain a list of datasets available for download.

## Download Your Dataset of Choice

Choose the name of a dataset to download and pass it as an argument to `phoenix.load_example`. For example, run the following to download production and training data for our demo sentiment classification model:

```python
datasets = px.load_example("sentiment_classification_language_drift")
datasets
```

`px.load_example` returns your downloaded data in the form of a `DatasetDict` instance. After running the code above, you should see the following in your cell output.

```
DatasetDict({
    'primary': Dataset(
        dataframe=...,
        schema=...,
        name='sentiment_classification_language_drift_primary',
    ),
    'reference': Dataset(
        dataframe=...,
        schema=...,
        name='sentiment_classification_language_drift_reference',
    ),
})
```

## Inspect Your Datasets

Inspect your primary dataset with

```python
datasets.primary
```

You should see the following in your cell output:

```
Phoenix Dataset
===============

name: 'sentiment_classification_language_drift_primary'

dataframe:
    columns: ['prediction_ts', 'reviewer_age', 'reviewer_gender', 'product_category', 'language', 'text', 'text_vector', 'label', 'pred_label', 'prediction_id']
    shape: (33411, 10)

schema: Schema(
    prediction_id_column_name='prediction_id',
    timestamp_column_name='prediction_ts',
    feature_column_names=[
        'reviewer_age',
        'reviewer_gender',
        'product_category',
        'language',
    ],
    prediction_label_column_name='pred_label',
    actual_label_column_name='label',
    embedding_feature_column_names={
        'text_embedding': EmbeddingColumnNames(
            vector_column_name='text_vector',
            raw_data_column_name='text',
        ),
    },
)
```

Here, you can see the three pieces of information that define your dataset:

* A name for the dataset that appears in the UI
* The data itself in the form of a Pandas DataFrame
* A schema describing the format of your data

You can similarly inspect your reference dataset with

```python
datasets.reference
```

## Launch the App

Launch Phoenix with

```python
px.launch_app(datasets.primary, datasets.reference)
```

Follow the instructions in the cell output to open the Phoenix UI in your notebook or in a separate browser tab.

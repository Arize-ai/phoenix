---
description: Quickly explore Phoenix with concrete examples
---

# Use Example Datasets

Phoenix ships with a collection of examples so you can quickly try out the app on concrete use-cases. This guide shows you how to download, inspect, and launch the app with example datasets.

## View Available Datasets

To see a list of datasets available for download, run

```python
px.load_example?
```

This displays the docstring for the `phoenix.load_example` function, which contain a list of datasets available for download.

## Download Your Dataset of Choice

Choose the name of a dataset to download and pass it as an argument to `phoenix.load_example`. For example, run the following to download production and training data for our demo sentiment classification model:

```python
datasets = px.load_example("sentiment_classification_language_drift")
datasets
```

`px.load_example` returns your downloaded data in the form of an `ExampleDatasets` instance. After running the code above, you should see the following in your cell output.

```
ExampleDatasets(primary=<Dataset "sentiment_classification_language_drift_primary">, reference=<Dataset "sentiment_classification_language_drift_reference">)
```

## Inspect Your Datasets

Next, inspect the name, dataframe, and schema that define your primary dataset. First, run

```python
prim_ds = datasets.primary
prim_ds.name
```

to see the name of the dataset in your cell output:

```
'sentiment_classification_language_drift_primary'
```

Next, run

```python
prim_ds.schema
```

to see your dataset's schema in the cell output:

```
Schema(prediction_id_column_name='prediction_id', timestamp_column_name='prediction_ts', feature_column_names=['reviewer_age', 'reviewer_gender', 'product_category', 'language'], tag_column_names=None, prediction_label_column_name='pred_label', prediction_score_column_name=None, actual_label_column_name='label', actual_score_column_name=None, embedding_feature_column_names={'text_embedding': EmbeddingColumnNames(vector_column_name='text_vector', raw_data_column_name='text', link_to_data_column_name=None)}, excluded_column_names=None)
```

Last, run

```python
prim_ds.dataframe.info()
```

to get an overview of your dataset's underlying dataframe:

```
<class 'pandas.core.frame.DataFrame'>
DatetimeIndex: 33411 entries, 2022-05-01 07:00:16+00:00 to 2022-06-01 07:00:16+00:00
Data columns (total 10 columns):
 #   Column            Non-Null Count  Dtype
---  ------            --------------  -----
 0   prediction_ts     33411 non-null  datetime64[ns, UTC]
 1   reviewer_age      33411 non-null  int16
 2   reviewer_gender   33411 non-null  object
 3   product_category  33411 non-null  object
 4   language          33411 non-null  object
 5   text              33411 non-null  object
 6   text_vector       33411 non-null  object
 7   label             33411 non-null  object
 8   pred_label        33411 non-null  object
 9   prediction_id     0 non-null      object
dtypes: datetime64[ns, UTC](1), int16(1), object(8)
memory usage: 2.6+ MB
```

## Launch the App

Launch Phoenix with

```python
px.launch_app(datasets.primary, datasets.reference)
```

Follow the instructions in the cell output to open the Phoenix UI in your notebook or in a separate browser tab.

## View Available Traces

Phoenix supports [LLM application Traces](../concepts/llm-traces.md) and has examples that you can take a look at as well.\

```python
px.load_example_traces?

# Load up the LlamaIndex RAG example
px.launch_app(trace=px.load_example_traces("llama_index_rag"))
```

---
description: >-
  This guide shows how LLM evaluation results in dataframes can be sent to
  Phoenix.
---

# Log Evaluation Results

Evaluations, which can be considered a form of automated annotation, are logged as annotations inside of Phoenix. 
Instead of coming from a "HUMAN" source, they are either "CODE" (aka heuristic) or "LLM" kinds. 
An evaluation must have a name (e.g. "Q\&A Correctness") and its DataFrame must contain identifiers for the subject of evaluation, e.g. a span or a document (more on that below), and values under either the `score`, `label`, or `explanation` columns. An optional `metadata` column can also be provided.

## Connect to Phoenix

Initialize the Phoenix client to connect to your Phoenix instance:

```python
from phoenix.client import Client

# Initialize client - automatically reads from environment variables:
# PHOENIX_BASE_URL and PHOENIX_API_KEY (if using Phoenix Cloud)
client = Client()

# Or explicitly configure for your Phoenix instance:
# client = Client(base_url="https://your-phoenix-instance.com", api_key="your-api-key")
```

## Span Evaluations

A dataframe of span evaluations would look similar to the table below. It must contain `span_id` as an index or as a column. Once ingested, Phoenix uses the `span_id` to associate the evaluation with its target span.

<table><thead><tr><th>span_id</th><th>label</th><th data-type="number">score</th><th>explanation</th></tr></thead><tbody><tr><td>5B8EF798A381</td><td>correct</td><td>1</td><td>"this is correct ..."</td></tr><tr><td>E19B7EC3GG02</td><td>incorrect</td><td>0</td><td>"this is incorrect ..."</td></tr></tbody></table>

The evaluations dataframe can be sent to Phoenix as follows. 

Note that the name and kind of the evaluation can be supplied through the `annotation_name` `annotator_kind` parameters, or as columns with the same names in the dataframe.

```python
from phoenix.client import Client()

Client().log_span_annotations(
    dataframe=qa_correctness_eval_df,
    annotation_name="QA Correctness",
    annotator_kind="LLM"
)
```

## Document Evaluations

A dataframe of document evaluations would look something like the table below. It must contain `span_id` and `document_position` as either indices or columns. `document_position` is the document's (zero-based) index in the span's list of retrieved documents. Once ingested, Phoenix uses the `span_id` and `document_position` to associate the evaluation with its target span and document.

<table><thead><tr><th>span_id</th><th data-type="number">document_position</th><th width="109">label</th><th width="82" data-type="number">score</th><th>explanation</th></tr></thead><tbody><tr><td>5B8EF798A381</td><td>0</td><td>relevant</td><td>1</td><td>"this is ..."</td></tr><tr><td>5B8EF798A381</td><td>1</td><td>irrelevant</td><td>0</td><td>"this is ..."</td></tr><tr><td>E19B7EC3GG02</td><td>0</td><td>relevant</td><td>1</td><td>"this is ..."</td></tr></tbody></table>

The evaluations dataframe can be sent to Phoenix as follows. In this case we name it "Relevance".

```python
from phoenix.client import Client

Client().spans.log_document_annotations_dataframe(
    dataframe=document_relevance_eval_df,
    annotation_name="Relevance",
    annotator_kind="LLM",
)
```

## Logging Multiple Evaluation DataFrames

Multiple sets of Evaluations can be logged using separate function calls with the new client.

```python
client.spans.log_span_annotations_dataframe(
    dataframe=qa_correctness_eval_df,
    annotation_name="Q&A Correctness",
    annotator_kind="LLM",
)
client.spans.log_document_annotations_dataframe(
    dataframe=document_relevance_eval_df,
    annotation_name="Relevance",
    annotator_kind="LLM",
)
client.spans.log_span_annotations_dataframe(
    dataframe=hallucination_eval_df,
    annotation_name="Hallucination",
    annotator_kind="LLM",
)
# ... continue with additional evaluations as needed
```

Or, if you specify the `annotation_name` and  `annotator_kind` as columns, you can vertically concatenate the dataframes and upload them all at once. 

```python
import pandas as pd 

qa_correctness_eval_df["annotation_name"] = "QA Correctness"
qa_correctness_eval_df["annotator_kind"] = "LLM"

hallucination_eval_df["annotation_name"] = "Hallucination"
hallucination_eval_df["annotator_kind"] = "LLM"

annotations_df = pd.concat([qa_correctness_eval_df, hallucination_eval_df], ignore_index=True)

px_client.spans.log_span_annotations_dataframe(dataframe=annotations_df)
```
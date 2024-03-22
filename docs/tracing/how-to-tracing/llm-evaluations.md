---
description: >-
  This guide shows how LLM evaluation results in dataframes can be sent to
  Phoenix.
---

# Log Evaluation Results

An evaluation must have a `name` (e.g. "Q\&A Correctness") and its DataFrame must contain identifiers for the subject of evaluation, e.g. a span or a document (more on that below), and values under either the `score`, `label`, or `explanation` columns. See [Evaluations](../../evaluation/concepts-evals/evaluation.md) for more information.

## Span Evaluations

A dataframe of span evaluations would look similar like the table below. It must contain `span_id` as an index or as a column. Once ingested, Phoenix uses the `span_id` to associate the evaluation with its target span.

<table><thead><tr><th>span_id</th><th>label</th><th data-type="number">value</th></tr></thead><tbody><tr><td>5B8EF798A381</td><td>correct</td><td>1</td></tr><tr><td>E19B7EC3GG02</td><td>incorrect</td><td>0</td></tr></tbody></table>

The evaluations dataframe can be sent to Phoenix as follows. Note that the name of the evaluation must be supplied through the `eval_name=` parameter. In this case we name it "Q\&A Correctness".

```python
from phoenix.trace import SpanEvaluations

px.Client().log_evaluations(
    SpanEvaluations(
        dataframe=qa_correctness_eval_df,
        eval_name="Q&A Correctness",
    ),
)
```

## Document Evaluations

A dataframe of document evaluations would look something like the table below. It must contain `span_id` and `document_position` as either indices or columns. `document_position` is the document's (zero-based) index in the span's list of retrieved documents. Once ingested, Phoenix uses the `span_id` and `document_position` to associate the evaluation with its target span and document.

<table><thead><tr><th>span_id</th><th data-type="number">document_position</th><th>label</th><th data-type="number">score</th></tr></thead><tbody><tr><td>5B8EF798A381</td><td>0</td><td>relevant</td><td>1</td></tr><tr><td>5B8EF798A381</td><td>1</td><td>irrelevant</td><td>0</td></tr><tr><td>E19B7EC3GG02</td><td>0</td><td>relevant</td><td>1</td></tr></tbody></table>

The evaluations dataframe can be sent to Phoenix as follows. Note that the name of the evaluation must be supplied through the `eval_name=` parameter. In this case we name it "Relevance".

```python
from phoenix.trace import DocumentEvaluations

px.Client().log_evaluations(
    DocumentEvaluations(
        dataframe=document_relevance_eval_df,
        eval_name="Relevance",
    ),
)
```

## Logging Multiple Evaluation DataFrames

Multiple evaluation datasets can be logged by the same `px.Client().log_evaluations()` function call.

```
px.Client().log_evaluations(
    SpanEvaluations(
        dataframe=qa_correctness_eval_df,
        eval_name="Q&A Correctness",
    ),
    DocumentEvaluations(
        dataframe=document_relevance_eval_df,
        eval_name="Relevance",
    ),
    SpanEvaluations(
        dataframe=hallucination_eval_df,
        eval_name="Hallucination",
    ),
    # ... as many as you like
)
```

## Specifying A Project for the Evaluations

By default the client will push traces to the project specified in the `PHOENIX_PROJECT_NAME` environment variable or to the `default` project. If you want to specify the destination project explicitly, you can pass the project name as a parameter.

```python
from phoenix.trace import SpanEvaluations

px.Client().log_evaluations(
    SpanEvaluations(
        dataframe=qa_correctness_eval_df,
        eval_name="Q&A Correctness",
    ),
    project_name="<my-project>"
)
```


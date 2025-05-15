---
description: Various options for to help you get data out of Phoenix
---

# Export Data & Query Spans

## Options for Exporting Data from Phoenix

| Method                                                                                               | Description                                        | Helpful for                                                                               |
| ---------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| [Download all spans as a dataframe](extract-data-from-spans.md#downloading-all-spans-as-a-dataframe) | Exports all spans in a project as a dataframe      | **Evaluation** - Filtering your spans locally using pandas instead of Phoenix DSL.        |
| [Span Queries](extract-data-from-spans.md#running-span-queries)                                      | Exports specific spans or traces based on filters  | **Evaluation** - Querying spans from Phoenix                                              |
| [Pre-defined Queries](extract-data-from-spans.md#pre-defined-queries)                                | Exports specific groups of spans from a RAG system | **RAG Evaluation** - Easily exporting retrieved documents or Q\&A data from a RAG system. |
| [Saving All Traces](extract-data-from-spans.md#save-all-traces)                                      | Saves all traces as a local file                   | **Storing Data** - Backing up an entire Phoenix instance.                                 |

## Connect to Phoenix

Before using any of the methods above, make sure you've connected to `px.Client()` . You'll need to set the following environment variables:

```python
import os

os.environ["PHOENIX_CLIENT_HEADERS"] = f"api_key=..."
os.environ["PHOENIX_COLLECTOR_ENDPOINT"] = "https://app.phoenix.arize.com"
```

If you're self-hosting Phoenix, ignore the client headers and change the collector endpoint to your endpoint.

## Downloading all Spans as a Dataframe

If you prefer to handle your filtering locally, you can also download all spans as a dataframe using the `get_spans_dataframe()` function:

```python
import phoenix as px

# Download all spans from your default project
px.Client().get_spans_dataframe()

# Download all spans from a specific project
px.Client().get_spans_dataframe(project_name='your project name')

# You can query for spans with the same filter conditions as in the UI
px.Client().get_spans_dataframe("span_kind == 'CHAIN'")
```

## Running Span Queries

You can query for data using our **query DSL** (domain specific language).

{% hint style="success" %}
This **Query DSL** is the same as what is used by the filter bar in the dashboard. It can be helpful to form your query string in the Phoenix dashboard for more immediate feedback, before moving it to code.
{% endhint %}

Below is an example of how to pull all retriever spans and select the input value. The output of this query is a DataFrame that contains the input values for all retriever spans.

```python
import phoenix as px
from phoenix.trace.dsl import SpanQuery

query = SpanQuery().where(
    # Filter for the `RETRIEVER` span kind.
    # The filter condition is a string of valid Python boolean expression.
    "span_kind == 'RETRIEVER'",
).select(
    # Extract the span attribute `input.value` which contains the query for the
    # retriever. Rename it as the `input` column in the output dataframe.
    input="input.value",
)

# The Phoenix Client can take this query and return the dataframe.
px.Client().query_spans(query)
```

{% hint style="info" %}
**DataFrame Index**\
By default, the result DataFrame is indexed by `span_id`, and if `.explode()` is used, the index from the exploded list is added to create a multi-index on the result DataFrame. For the special `retrieval.documents` span attribute, the added index is renamed as `document_position`.
{% endhint %}

### How to Specify a Time Range

By default, all queries will collect all spans that are in your Phoenix instance. If you'd like to focus on most recent spans, you can pull spans based on time frames using `start_time` and `end_time`.

```python
import phoenix as px
from phoenix.trace.dsl import SpanQuery
from datetime import datetime, timedelta

# Initiate Phoenix client
px_client = px.Client()

# Get spans from the last 7 days only
start = datetime.now() - timedelta(days=7)

# Get spans to exclude the last 24 hours
end = datetime.now() - timedelta(days=1)

phoenix_df = px_client.query_spans(start_time=start, end_time=end)
```

### How to Specify a Project

By default all queries are executed against the default project or the project set via the `PHOENIX_PROJECT_NAME` environment variable. If you choose to pull from a different project, all methods on the [Client](https://docs.arize.com/phoenix/references/api/client) have an optional parameter named `project_name`

```python
import phoenix as px
from phoenix.trace.dsl import SpanQuery

# Get spans from a project
px.Client().get_spans_dataframe(project_name="<my-project>")

# Using the query DSL
query = SpanQuery().where("span_kind == 'CHAIN'").select(input="input.value")
px.Client().query_spans(query, project_name="<my-project>")
```

### Querying for Retrieved Documents

Let's say we want to extract the retrieved documents into a DataFrame that looks something like the table below, where `input` denotes the query for the retriever, `reference` denotes the content of each document, and `document_position` denotes the (zero-based) index in each span's list of retrieved documents.

Note that this DataFrame can be used directly as input for the [Retrieval (RAG) Relevance evaluations](../../../evaluation/how-to-evals/running-pre-tested-evals/retrieval-rag-relevance.md#how-to-run-the-eval).

| context.span\_id | document\_position | input                                            | reference                                                |
| ---------------- | ------------------ | ------------------------------------------------ | -------------------------------------------------------- |
| 5B8EF798A381     | 0                  | What was the author's motivation for writing ... | In fact, I decided to write a book about ...             |
| 5B8EF798A381     | 1                  | What was the author's motivation for writing ... | I started writing essays again, and wrote a bunch of ... |
| ...              | ...                | ...                                              | ...                                                      |
| E19B7EC3GG02     | 0                  | What did the author learn about ...              | The good part was that I got paid huge amounts of ...    |

We can accomplish this with a simple query as follows. Also see [Predefined Queries](extract-data-from-spans.md#retrieved-documents) for a helper function executing this query.

```python
from phoenix.trace.dsl import SpanQuery

query = SpanQuery().where(
    # Filter for the `RETRIEVER` span kind.
    # The filter condition is a string of valid Python boolean expression.
    "span_kind == 'RETRIEVER'",
).select(
    # Extract the span attribute `input.value` which contains the query for the
    # retriever. Rename it as the `input` column in the output dataframe.
    input="input.value",
).explode(
    # Specify the span attribute `retrieval.documents` which contains a list of
    # objects and explode the list. Extract the `document.content` attribute from
    # each object and rename it as the `reference` column in the output dataframe.
    "retrieval.documents",
    reference="document.content",
)

# The Phoenix Client can take this query and return the dataframe.
px.Client().query_spans(query)
```

### How to Explode Attributes

In addition to the document content, if we also want to explode the document score, we can simply add the `document.score` attribute to the `.explode()` method alongside `document.content` as follows. Keyword arguments are necessary to name the output columns, and in this example we name the output columns as `reference` and `score`. (Python's double-asterisk unpacking idiom can be used to specify arbitrary output names containing spaces or symbols. See [here](extract-data-from-spans.md#arbitrary-output-column-names) for an example.)

```python
query = SpanQuery().explode(
    "retrieval.documents",
    reference="document.content",
    score="document.score",
)
```

### How to Apply Filters

The `.where()` method accepts a string of valid Python boolean expression. The expression can be arbitrarily complex, but restrictions apply, e.g. making function calls are generally disallowed. Below is a conjunction filtering also on whether the input value contains the string `'programming'`.

```python
query = SpanQuery().where(
    "span_kind == 'RETRIEVER' and 'programming' in input.value"
)
```

#### Filtering Spans by Evaluation Results

Filtering spans by evaluation results, e.g. `score` or `label`, can be done via a special syntax. The name of the evaluation is specified as an indexer on the special keyword `evals`. The example below filters for spans with the `incorrect` label on their `correctness` evaluations. (See [here](../../../evaluation/how-to-evals/running-pre-tested-evals/) for how to compute evaluations for traces, and [here](../feedback-and-annotations/llm-evaluations.md) for how to ingest those results back to Phoenix.)

```python
query = SpanQuery().where(
    "evals['correctness'].label == 'incorrect'"
)
```

#### Filtering on Metadata

`metadata` is an attribute that is a dictionary and it can be filtered like a dictionary.

```python
query = SpanQuery().where(
    "metadata["topic"] == 'programming'"
)
```

#### Filtering for Substring

Note that Python strings do not have a `contain` method, and substring search is done with the `in` operator.

```python
query = SpanQuery().where(
    "'programming' in metadata["topic"]"
)
```

#### **Filtering for No Evaluations**

Get spans that do not have an evaluation attached yet

```python
query = SpanQuery().where(
    "evals['correctness'].label is None"
)
# correctness is whatever you named your evaluation metric
```

### How to Apply Filters (UI)

You can also use Python boolean expressions to filter spans in the Phoenix UI. These expressions can be entered directly into the search bar above your experiment runs, allowing you to apply complex conditions involving span attributes. Any expressions that work with the `.where()` method [above](extract-data-from-spans.md#how-to-apply-filters) can also be used in the UI.

### How to Extract Attributes

Span attributes can be selected by simply listing them inside `.select()` method.

```python
query = SpanQuery().select(
    "input.value",
    "output.value",
)
```

#### Renaming Output Columns

Keyword-argument style can be used to rename the columns in the dataframe. The example below returns two columns named `input` and `output` instead of the original names of the attributes.

```python
query = SpanQuery().select(
    input="input.value",
    output="output.value",
)
```

#### Arbitrary Output Column Names

If arbitrary output names are desired, e.g. names with spaces and symbols, we can leverage Python's double-asterisk idiom for unpacking a dictionary, as shown below.

```python
query = SpanQuery().select(**{
    "Value (Input)": "input.value",
    "Value (Output)": "output.value",
})
```

### Advanced Usage

#### Concatenating

The document contents can also be concatenated together. The query below concatenates the list of `document.content` with  (double newlines), which is the default separator. Keyword arguments are necessary to name the output columns, and in this example we name the output column as `reference`. (Python's double-asterisk unpacking idiom can be used to specify arbitrary output names containing spaces or symbols. See [here](extract-data-from-spans.md#arbitrary-output-column-names) for an example.)

```python
query = SpanQuery().concat(
    "retrieval.documents",
    reference="document.content",
)
```

#### Special Separators

If a different separator is desired, say `\n************`, it can be specified as follows.

```python
query = SpanQuery().concat(
    "retrieval.documents",
    reference="document.content",
).with_concat_separator(
    separator="\n************\n",
)
```

#### Using Parent ID as Index

This is useful for joining a span to its parent span. To do that we would first index the child span by selecting its parent ID and renaming it as `span_id`. This works because `span_id` is a special column name: whichever column having that name will become the index of the output DataFrame.

```python
query = SpanQuery().select(
    span_id="parent_id",
    output="output.value",
)
```

#### Joining a Span to Its Parent

To do this, we would provide two queries to Phoenix which will return two simultaneous dataframes that can be joined together by pandas. The `query_for_child_spans` uses `parent_id` as index as shown in [Using Parent ID as Index](extract-data-from-spans.md#using-parent-id-as-index), and `px.Client().query_spans()` returns a list of dataframes when multiple queries are given.

```python
import pandas as pd

pd.concatenate(
    px.Client().query_spans(
        query_for_parent_spans,
        query_for_child_spans,
    ),
    axis=1,        # joining on the row indices
    join="inner",  # inner-join by the indices of the dataframes
)
```

### How to use Data for Evaluation

#### Extract the Input and Output from LLM Spans

To learn more about extracting span attributes, see [Extracting Span Attributes](extract-data-from-spans.md#extracting-span-attributes).

```python
from phoenix.trace.dsl import SpanQuery

query = SpanQuery().where(
    "span_kind == 'LLM'",
).select(
    input="input.value",
    output="output.value,
)

# The Phoenix Client can take this query and return a dataframe.
px.Client().query_spans(query)
```

### Retrieval (RAG) Relevance Evaluations

To extract the dataframe input for [Retrieval (RAG) Relevance evaluations](../../../evaluation/how-to-evals/running-pre-tested-evals/retrieval-rag-relevance.md#how-to-run-the-eval), we can apply the query described in the [Example](extract-data-from-spans.md#example), or leverage the [helper](extract-data-from-spans.md#retrieved-documents) function implementing the same query.

### Q\&A on Retrieved Data Evaluations

To extract the dataframe input to the [Q\&A on Retrieved Data evaluations](../../../evaluation/how-to-evals/running-pre-tested-evals/q-and-a-on-retrieved-data.md#how-to-run-the-eval), we can use a [helper](extract-data-from-spans.md#q-and-a-on-retrieved-data) function or use the following query (which is what's inside the helper function). This query applies techniques described in the [Advanced Usage](extract-data-from-spans.md#advanced-usage) section.

```python
import pandas as pd
from phoenix.trace.dsl import SpanQuery

query_for_root_span = SpanQuery().where(
    "parent_id is None",   # Filter for root spans
).select(
    input="input.value",   # Input contains the user's question
    output="output.value", # Output contains the LLM's answer
)

query_for_retrieved_documents = SpanQuery().where(
    "span_kind == 'RETRIEVER'",  # Filter for RETRIEVER span
).select(
    # Rename parent_id as span_id. This turns the parent_id
    # values into the index of the output dataframe.
    span_id="parent_id",
).concat(
    "retrieval.documents",
    reference="document.content",
)

# Perform an inner join on the two sets of spans.
pd.concat(
    px.Client().query_spans(
        query_for_root_span,
        query_for_retrieved_documents,
    ),
    axis=1,
    join="inner",
)
```

## Pre-defined Queries

Phoenix also provides helper functions that executes predefined queries for the following use cases.

{% hint style="info" %}
If you need to run the query against a specific project, you can add the `project_name` as a parameter to any of the pre-defined queries
{% endhint %}

### Retrieved Documents

The query shown in the [example](extract-data-from-spans.md#example) can be done more simply with a helper function as follows. The output DataFrame can be used directly as input for the [Retrieval (RAG) Relevance evaluations](../../../evaluation/how-to-evals/running-pre-tested-evals/retrieval-rag-relevance.md#how-to-run-the-eval).

```python
from phoenix.session.evaluation import get_retrieved_documents

retrieved_documents = get_retrieved_documents(px.Client())
retrieved_documents
```

### Q\&A on Retrieved Data

To extract the dataframe input to the [Q\&A on Retrieved Data evaluations](../../../evaluation/how-to-evals/running-pre-tested-evals/q-and-a-on-retrieved-data.md#how-to-run-the-eval), we can use the following helper function.

```python
from phoenix.session.evaluation import get_qa_with_reference

qa_with_reference = get_qa_with_reference(px.Client())
qa_with_reference
```

The output DataFrame would look something like the one below. The `input` contains contains the question, the `output` column contains the answer, and the `reference` column contains a concatenation of all the retrieved documents. This helper function assumes that the questions and answers are the `input.value` and `output.value` attributes of the root spans, and the list of retrieved documents are contained in a direct child span of the root span. (The helper function applies the techniques described in the [Advanced Usage](extract-data-from-spans.md#advanced-usage) section.)

<table><thead><tr><th width="179">context.span_id</th><th>input</th><th>output</th><th>reference</th></tr></thead><tbody><tr><td>CDBC4CE34</td><td>What was the author's trick for ...</td><td>The author's trick for ...</td><td>Even then it took me several years to understand ...</td></tr><tr><td>...</td><td>...</td><td>...</td><td>...</td></tr></tbody></table>

## Save All Traces

Sometimes you may want to back up your Phoenix traces to a single file, rather than exporting specific spans to run evaluation.

Use the following command to save all traces from a Phoenix instance to a designated location.

```python
my_traces = px.Client().get_trace_dataset().save()
```

You can specify the directory to save your traces by passing a`directory` argument to the `save` method.

```python
import os

# Specify and Create the Directory for Trace Dataset
directory = '/my_saved_traces'
os.makedirs(directory, exist_ok=True)

# Save the Trace Dataset
trace_id = px.Client().get_trace_dataset().save(directory=directory)
```

This output the trace ID and prints the path of the saved file:

`💾 Trace dataset saved to under ID: f7733fda-6ad6-4427-a803-55ad2182b662`

`📂 Trace dataset path: /my_saved_traces/trace_dataset-f7733fda-6ad6-4427-a803-55ad2182b662.parquet`

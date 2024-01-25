---
description: Spans can be filtered via Python boolean expressions.
---

# Filter Spans

* [Examples](filter-spans.md#examples)

## Introduction

Spans can be filtered using the UI search bar and by span [queries](extract-data-from-spans.md#filtering-spans). Both use the same syntax, i.e. Python boolean expressions involving the span attributes (e.g. `output.value`). The expression can be arbitrarily complex, but restrictions apply: e.g. arbitrary function calls are disabled.

## Usage

### Phoenix UI

The Phoenix UI has a search bar where the filter expression can be entered. Autocompletion hints are also available as you interact with the search bar.

<figure><img src="https://storage.cloud.google.com/arize-assets/phoenix/assets/images/UI_search_bar_basic_example.png?authuser=0" alt="" width="375"><figcaption><p>Enter a Python boolean expression in the search bar</p></figcaption></figure>

### Span Queries

See the [guide](extract-data-from-spans.md#filtering-spans) on span queries for more details. The `.where()` method of span query takes as input a string of Python boolean expression and converts it into a filter. The example below returns a dataframe containing the LLM spans (having input and output values as columns of the dataframe).

```python
from phoenix.trace.dsl import SpanQuery

query = SpanQuery().where(
    "span_kind == 'LLM'",  # filter for the LLM span kind
).select(
    "input.value",         # input.value as the first output column
    "output.value",        # output.value as the second output column
)

# The active Phoenix session can take this query and return the dataframe.
px.active_session().query_spans(query)
```

## Examples

### Filter by Substring

Use the `in` operator, in lieu of the `.contain()` method, to filter for substrings. The example below filters for `programming` as a substring of the output value.

```
'programming' in output.value
```

### Filter by Evaluation Results

Filtering spans by evaluation results, e.g. `score` or `label`, can be done via a special syntax. The name of the evaluation is specified as an indexer on the special keyword `evals`. The example below filters for spans with the `incorrect` label on their `correctness` evaluations.

```
evals['correctness'].label == 'incorrect'
```

# Score traces in Python

Read records from a Phoenix project, run evaluators over them, and log the results
back as annotations. Pick the level first: the level you read is the level you
annotate.

| Level | Read | Log |
| ----- | ---- | --- |
| Span | `client.spans.get_spans_dataframe` | `client.spans.log_span_annotations_dataframe` |
| Trace | root spans from `get_spans_dataframe` | `client.traces.log_trace_annotations_dataframe` |
| Session | `client.sessions.get_session_turns` | `client.sessions.log_session_annotations_dataframe` |
| Document | retriever spans, one row per document | `client.spans.log_document_annotations_dataframe` |

## Read spans

```python
from phoenix.client import Client
from phoenix.client.types.spans import SpanQuery

client = Client()

spans_df = client.spans.get_spans_dataframe(
    project_identifier="my-app",
    query=SpanQuery().where("parent_id is None"),  # root spans: one row per trace
    limit=1000,
)
```

The dataframe is indexed by `context.span_id`. Columns include `context.trace_id`,
`parent_id`, `name`, `span_kind`, `status_code`, `start_time`, `end_time`, and one
`attributes.<key>` column per span attribute, such as `attributes.input.value`,
`attributes.output.value`, and `attributes.session.id`.

- Every read has a default limit: 1,000 rows for `get_spans_dataframe`, 100 for
  `client.spans.get_spans` and for `client.traces.get_traces`. Set `limit` above
  the project's size, or page by time windows that cover the whole project.
  Otherwise the evaluation silently covers only part of it.
- Every read also has a 5-second timeout by default. Pass `timeout=60` or more for
  large reads, or page by time window.
- Don't add a narrow `start_time` unless the user asks for a window; historical
  traces can be days old.
- `where` takes a span filter, such as `span_kind == 'LLM'` or `name == 'answer'`. The
  filter grammar is in phoenix-cli.
- Inputs and outputs are often JSON strings, such as a chat message list or a
  framework object. Print a few values and parse out the text the evaluator needs.

## Read a trace's child spans

Evidence for a per-trace judgment often sits below the root span: tool calls and
results, retriever documents, intermediate LLM calls. Read every span of the traces
you're scoring, with attributes:

```python
trace_ids = spans_df["context.trace_id"].unique().tolist()
child_spans = client.spans.get_spans(
    project_identifier="my-app", trace_ids=trace_ids, limit=10000
)
tool_spans = [span for span in child_spans if span.get("span_kind") == "TOOL"]
```

`client.traces.get_traces(include_spans=True)` lists each trace's spans without
their attributes, so use it to find traces, not to read evidence. It takes a trace
`filter` such as `error_count > 0`.

## Run evaluators over a dataframe

Build a dataframe whose column names are the evaluator's input names, keeping the
span ID index so results can go back onto the spans:

```python
import pandas as pd

from phoenix.evals import async_evaluate_dataframe

eval_df = pd.DataFrame(
    {
        "input": spans_df["attributes.input.value"],
        "output": spans_df["attributes.output.value"],
    },
    index=spans_df.index,
)
results_df = await async_evaluate_dataframe(
    dataframe=eval_df, evaluators=[grounded, has_citation], exit_on_error=False
)
```

For the result columns, retries, and how to read scores and errors out of the
result, see "Evaluate a dataframe" in [evaluators-python](evaluators-python.md).

## Log span annotations

Leave out rows the evaluator failed on, and report how many there were, so errors
don't land in Phoenix as blank annotations:

```python
from phoenix.evals.utils import to_annotation_dataframe

succeeded = results_df["grounded_execution_details"].apply(
    lambda d: d.get("status") in ("COMPLETED", "COMPLETED WITH RETRIES")
)
print(f"scored {succeeded.sum()}, failed {(~succeeded).sum()}")
annotations_df = to_annotation_dataframe(dataframe=results_df[succeeded])
client.spans.log_span_annotations_dataframe(dataframe=annotations_df, sync=True)
```

`to_annotation_dataframe` reads every `*_score` column (or only `score_names=[...]`)
and returns one row per span and score with `annotation_name`, `annotator_kind`,
`label`, `score`, `explanation`, and `metadata`. It needs the span ID in the index or
in a `span_id` column.

- Logging is asynchronous by default, so the server can take a moment to show the
  annotations. Pass `sync=True` when the next step reads them back.
- Logging an annotation with the same name on the same span replaces the old one. To
  keep several annotations with one name on a span, such as one per reviewer, give
  each a distinct `identifier`.

## Log trace and session annotations

`to_annotation_dataframe` keys rows by span ID only. For traces and sessions, index
the evaluation dataframe by the trace or session ID and build the annotation rows
yourself:

```python
import pandas as pd


def to_annotations(results_df: pd.DataFrame, score_name: str, id_column: str) -> pd.DataFrame:
    """Returns one annotation row per successfully scored record for score_name."""
    scores = results_df[f"{score_name}_score"]
    scores = scores[scores.notna()]  # failed rows hold None; count them before dropping
    return pd.DataFrame(
        {
            id_column: scores.index,
            "annotation_name": score_name,
            "annotator_kind": scores.apply(lambda s: (s.get("kind") or "llm").upper()),
            "label": scores.apply(lambda s: s.get("label")),
            "score": scores.apply(lambda s: s.get("score")),
            "explanation": scores.apply(lambda s: s.get("explanation")),
        }
    )


trace_eval_df = eval_df.set_index(spans_df["context.trace_id"])
trace_results = await async_evaluate_dataframe(dataframe=trace_eval_df, evaluators=[grounded])
client.traces.log_trace_annotations_dataframe(
    dataframe=to_annotations(trace_results, "grounded", "trace_id"), sync=True
)
```

## Score sessions

A session is a conversation: the traces that share a `session.id`. A session-level
judge needs the whole transcript in order. Read every session's root spans in one
query, then group them by session:

```python
sessions_roots = client.spans.get_spans_dataframe(
    project_identifier="my-app",
    query=SpanQuery().where("parent_id is None and session.id is not None"),
    limit=10000,
    timeout=60,
).sort_values("start_time")

rows = []
for session_id, session_spans in sessions_roots.groupby("attributes.session.id"):
    turns = [
        {"role": role, "content": text}
        for _, span in session_spans.iterrows()
        for role, text in (
            ("user", span["attributes.input.value"]),
            ("assistant", span["attributes.output.value"]),
        )
        if isinstance(text, str) and text
    ]
    rows.append({"session_id": session_id, "turns": turns})

session_eval_df = pd.DataFrame(rows).set_index("session_id")
session_results = await async_evaluate_dataframe(
    dataframe=session_eval_df, evaluators=[resolved], exit_on_error=False
)
client.sessions.log_session_annotations_dataframe(
    dataframe=to_annotations(session_results, "resolved", "session_id"), sync=True
)
```

`resolved` is the transcript judge from "Format structured inputs in the template"
in [evaluators-python](evaluators-python.md). A turn with no output, such as one
where the app errored, appears with the user message only.

Root spans hold each turn's input and output, without tool calls. When the judge
needs tool calls and results, or the history lives on an LLM span's message list,
read the turns' child spans by trace ID, as in "Read a trace's child spans", and add
them to `turns`. To score one session, `client.sessions.get_session_turns(session_id=...)`
returns the same turns in order, but it makes separate requests for every session.

## Score retrieved documents

See [rag](rag.md) for reading documents and logging document annotations.

## Write a script that keeps scoring new traces

When the user wants scoring to continue as traces arrive, write a script that:

1. Reads the records, paging when there could be more than `limit`.
2. Reads which records already have a current annotation and skips them. Current
   means the annotation came from this version of the evaluator and is newer than
   the record's last activity. Store the version in the annotation's `metadata`.
   After you change the evaluator, rescore everything.

   For spans:

   ```python
   existing = client.spans.get_span_annotations_dataframe(
       spans_dataframe=spans_df,
       project_identifier="my-app",
       include_annotation_names=["grounded"],
   )
   to_score = spans_df[~spans_df.index.isin(existing.index)]
   ```

   Filter `existing` further on `updated_at` and the version in `metadata` before
   skipping. Trace and session annotations have no read method in the Python client;
   read them with the REST API described in phoenix-judge-alignment, or rescore
   those records every run.
3. Scores and logs only the records that need it, under the same annotation names
   as before.
4. Prints how many records it scored, skipped, and failed, and exits with a nonzero
   status when evaluator errors happened.

Take the project name, endpoint, and keys from arguments or the environment, never
from constants copied out of one run.

`get_span_annotations_dataframe` returns one row per annotation, indexed by
`span_id`, with `annotation_name`, `annotator_kind`, `result.label`, `result.score`,
`result.explanation`, `created_at`, `updated_at`, and `user_id`. It leaves out notes
unless you pass `exclude_annotation_names=[]`.

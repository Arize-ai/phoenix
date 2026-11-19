# Collect human labels in Python

## Span labels

```python
from phoenix.client import Client
from phoenix.client.types.spans import SpanQuery

client = Client()

spans_df = client.spans.get_spans_dataframe(
    project_identifier="my-app",
    query=SpanQuery().where("parent_id is None"),
)
annotations_df = client.spans.get_span_annotations_dataframe(
    spans_dataframe=spans_df,
    project_identifier="my-app",
    include_annotation_names=["reviewer_verdict"],
)
```

The result has one row per annotation, indexed by `span_id`, with
`annotation_name`, `annotator_kind`, `result.label`, `result.score`,
`result.explanation`, `identifier`, `created_at`, `updated_at`, and `user_id`.

Keep one current human label per record:

```python
import pandas as pd

human = annotations_df[annotations_df["annotator_kind"] == "HUMAN"].copy()
human["updated_at"] = pd.to_datetime(human["updated_at"])
latest = (
    human.reset_index()
    .sort_values("updated_at")
    .drop_duplicates(subset=["span_id", "annotation_name"], keep="last")
    .set_index("span_id")
)
labeled = latest[latest["result.label"].notna()]
```

- **Only human labels.** The same annotation name can also hold `LLM` or `CODE`
  results, including the judge you're testing. Filter on `annotator_kind`.
- **The latest label wins.** A reviewer who changed their mind left the old label in
  place when they used a different `identifier`. Sort by `updated_at` and keep the
  last one per record.
- **Missing labels aren't "fine".** Drop records with no human label instead of
  counting them as passes.
- **Notes aren't labels.** `get_span_annotations_dataframe` leaves out notes unless
  you ask for them.
- **Unsettled labels.** When the latest human label isn't a verdict (for example,
  "unsure" or "skip"), leave the record out instead of using an older verdict.
- **Check eligibility rules the user gives** (a date range, one reviewer, a
  category) before deduplicating, and report how many records each rule removed.

## Join labels and judge results on the same record

Reviewers and judges often annotate different spans of one trace: a reviewer labels
the root span or the whole trace, and the judge annotates the LLM span it read.
Read annotations for every span in the traces you care about, then key both sides
by trace ID (or session ID):

```python
all_spans = client.spans.get_spans_dataframe(project_identifier="my-app", limit=10000)
all_annotations = client.spans.get_span_annotations_dataframe(
    spans_dataframe=all_spans,
    project_identifier="my-app",
    include_annotation_names=["reviewer_verdict", "judge_verdict"],
)
all_annotations["trace_id"] = all_spans.loc[all_annotations.index, "context.trace_id"].to_numpy()
```

Then deduplicate per `trace_id` and annotation name as above, and add trace
annotations from the REST call below. Report how many records have a human label,
a judge result, both, or only one.

## Trace and session labels

The Python client doesn't read trace or session annotations. Call the REST API,
which returns the same fields (`name`, `annotator_kind`, `result`, `identifier`,
`updated_at`):

```python
import os

import httpx

base_url = os.environ.get("PHOENIX_ENDPOINT", "http://localhost:6006")
headers = {"Authorization": f"Bearer {os.environ['PHOENIX_API_KEY']}"} if os.environ.get("PHOENIX_API_KEY") else {}

trace_ids = spans_df["context.trace_id"].unique().tolist()
rows, cursor = [], None
while True:
    params = {"trace_ids": trace_ids, "include_annotation_names": ["reviewer_verdict"], "limit": 1000}
    if cursor:
        params["cursor"] = cursor
    response = httpx.get(
        f"{base_url}/v1/projects/my-app/trace_annotations", params=params, headers=headers
    )
    response.raise_for_status()
    body = response.json()
    rows.extend(body["data"])
    cursor = body.get("next_cursor")
    if not cursor:
        break
```

These endpoints return every annotation name, including notes, unless you pass
`include_annotation_names`. Sessions use `/v1/projects/{project}/session_annotations`
with `session_ids`. For a
large list of IDs, send them in batches of about 100. From the terminal,
`px trace list --include-annotations` shows each trace's annotation names and
results, without the annotator kind or timestamps.

## Save the labels as a dataset

A labeled dataset lets you rerun the judge as an experiment and keeps the labels
fixed while annotations keep changing.

```python
examples_df = pd.DataFrame(
    {
        "span_id": labeled.index,
        "question": spans_df.loc[labeled.index, "attributes.input.value"].to_numpy(),
        "answer": spans_df.loc[labeled.index, "attributes.output.value"].to_numpy(),
        "human_label": labeled["result.label"].to_numpy(),
        # Only when you will tune the judge: "dev" for tuning, "test" for the final check.
        "split": labeled.index.map(lambda span_id: "test" if span_id in test_ids else "dev"),
    }
)
dataset = client.datasets.create_dataset(
    name="reviewer-verdicts-2026-11",
    dataset_description="Latest human reviewer_verdict label per root span",
    dataframe=examples_df,
    input_keys=["question", "answer"],
    output_keys=["human_label"],
    split_key="split",
    span_id_key="span_id",
)
```

`test_ids` is the set of held-out record IDs (see the split in
[agreement-python](agreement-python.md)); leave the `split` column out when you're
only assessing the judge. Put the human label in the reference output and the record being judged in the
input. Create a new dataset (or a new version) rather than editing one that other
experiments already ran against.

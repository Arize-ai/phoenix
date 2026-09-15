# Filter expressions

A filter condition is a Python boolean expression that Phoenix compiles to SQL. There are three
filter languages, one each for spans, traces, and sessions, and the argument name picks the
language. The vocabularies do not mix.

| Language | Argument | Keeps | Accepted on |
| --- | --- | --- | --- |
| Span filter | `filterCondition` | individual spans | `Project.spans`, `Trace.spans`, project aggregates (`recordCount`, `tokenCountTotal`, `costSummary`, `latencyMsQuantile`, ...), `SpanQuery().where(...)` in the Python client, the UI spans filter bar |
| Trace filter | `traceFilterCondition` | every span of a matching trace | `Project.spans`, the UI traces filter bar, the `filter` query param on `GET /v1/projects/{id}/traces` |
| Session filter | `sessionFilterCondition` | sessions | `Project.sessions`, project aggregates, the UI sessions filter bar |

`filterCondition` and `traceFilterCondition` compose on `Project.spans`: matching spans inside
matching traces. `filterCondition` and `sessionFilterCondition` are mutually exclusive on the
aggregates that accept both.

## Checking a condition

| Need | GraphQL field on `Project` |
| --- | --- |
| Validate before running | `validateSpanFilterCondition(condition:)`, `validateTraceFilterCondition(condition:)`, `validateSessionFilterCondition(condition:)` → `{ isValid errorMessage }` |
| List bindable names | `traceFilterVocabulary`, `sessionFilterVocabulary` → `{ name type category description iterableName }` |
| Span filter names | no vocabulary field; the table under [Span filter](#span-filter) is exhaustive |

A span filter that returns no rows may be misspelled rather than unmatched. Check the spelling
against the vocabulary before concluding there is no data.

## Syntax shared by all three languages

### Operators

| Category | Accepted | Rejected |
| --- | --- | --- |
| Comparison | `==` `!=` `<` `<=` `>` `>=`; chained: `500 < latency_ms <= 2000` | `=` |
| Missing values | `is None`, `is not None` | `is null`, `null`, `is` with any other value |
| Membership | `x in [...]` exact; `'text' in field` case-insensitive substring; `not in` | `None` inside a list; a literal on the left (`1 in [1, 2]`); `like` |
| Logic | `and`, `or`, `not`, parentheses | `&&`, `\|\|`, `&`, `\|`, `!` |
| Arithmetic | `+` `-` `*` `/` `%` | `**`, `//`, bitwise operators |
| Casts | `float(x)`, `int(x)`, `str(x)` | `bool(x)`, any other function |
| Comprehensions | `any`, `all`, `len`, `sum`, `max`, `min` over a declared collection: `any(d.cost > 0 for d in cost_details)`; `len` takes a list comprehension | method calls (`name.startswith(...)`), `len(name)` |

### Literals

| Kind | Write | Not |
| --- | --- | --- |
| String | `'LLM'` or `"LLM"` | unquoted: `LLM` |
| Number | `100`, `0.5` | quoted: `'100'` |
| Boolean | `True`, `False` | `true`, `false` |
| Missing | `None` | `null`, `nil` |
| Datetime | ISO 8601 with an offset: `'2026-09-01T00:00:00Z'`, `'2026-09-01T00:00:00+00:00'` | without an offset |
| List | `['LLM', 'TOOL']`, same type throughout | mixed types; `None` elements |

### Rules that differ from Python

- A missing value fails every comparison, including `!=`. A span without `metadata['tier']`
  matches neither `metadata['tier'] == 'premium'` nor `metadata['tier'] != 'premium'`. Spell the
  missing case out: `metadata['tier'] != 'premium' or metadata['tier'] is None`.
- `is None` is true for an absent key and for a stored JSON `null`.
- Every operand of `and`, `or`, and `not` must itself be a condition. `name == 'x' and
  metadata['flag']` is rejected; write `metadata['flag'] == True`.
- The whole expression must be a condition. A bare `True` or a bare field is rejected.
- `'text' in field` ignores case. `==` and list membership are exact.
- Annotation accessors expose `.label` (string), `.score` (number), `.explanation` (string). The
  bare accessor is an existence check: `annotations['quality']`.

## Span filter

### Root spans

There is no `traces` connection and no root-span argument. Root-span scoping is a clause in
`filterCondition`, and it composes with everything else. The UI's traces table is
`spans(filterCondition: "parent_span is None", traceFilterCondition: ...)`.

| Clause | Keeps | Use when |
| --- | --- | --- |
| `parent_id is None` | spans with no parent id | the default |
| `parent_span is None` | those, plus orphans whose parent span was never received | you want every top-level span, including ones whose parent was dropped |

A root span is usually one per trace. Fragmented traces can have several.

### Vocabulary

This table is exhaustive. Every identifier not in it is read as an attribute path.

| Name | Type | Notes |
| --- | --- | --- |
| `span_id`, `trace_id`, `parent_id` | string | OpenTelemetry hex ids |
| `name` | string | span name |
| `span_kind` | enum | `'CHAIN'`, `'LLM'`, `'RETRIEVER'`, `'EMBEDDING'`, `'TOOL'`, `'AGENT'`, `'RERANKER'`, `'GUARDRAIL'`, `'EVALUATOR'`, `'PROMPT'`, `'UNKNOWN'`; literals are uppercased for you |
| `status_code` | enum | `'OK'`, `'ERROR'`, `'UNSET'`; literals are uppercased for you |
| `status_message` | string | error text |
| `latency_ms` | number | |
| `start_time`, `end_time` | datetime | |
| `cumulative_llm_token_count_prompt`, `cumulative_llm_token_count_completion`, `cumulative_llm_token_count_total` | number | this span plus its descendants |
| `llm.token_count.prompt`, `llm.token_count.completion`, `llm.token_count.total` | number | this span alone |
| `total_cost`, `prompt_cost`, `completion_cost` | number | `0` when the span has no cost row |
| `cost_details` | collection | iterable only; elements have `token_type` (string), `is_prompt` (boolean), `cost`, `tokens`, `cost_per_token` (number) |
| `parent_span` | reserved | only `is None` / `is not None`; `parent_span.name` is rejected |
| `annotations['name']` | annotation | on the span itself; `evals['name']` is a legacy alias |
| `trace_annotations['name']` | annotation | on the span's containing trace |
| `attributes[...]`, `metadata[...]`, any other dotted name | attribute | JSON attribute path; type unknown until read |

Legacy spellings still accepted: `context.span_id`, `context.trace_id`,
`cumulative_token_count.prompt`, `cumulative_token_count.completion`,
`cumulative_token_count.total`.

### Attributes

| Write | Reads |
| --- | --- |
| `llm.model_name`, `attributes['llm.model_name']`, `attributes['llm']['model_name']` | the same attribute |
| `metadata['topic']` | `attributes['metadata']['topic']` |
| `input.value`, `output.value` | the span's input and output text |
| `input.mime_type`, `output.mime_type` | the payload type |
| `attributes['tags'][0]` | the first element of a JSON array |
| `user.id` | `attributes['user']['id']` |

An attribute's type is unknown until the row is read. Compared against a number it is read as a
number, against `True` or `False` as a boolean, otherwise as text. Rows whose value cannot be
converted drop out instead of erroring. `float(x)`, `int(x)`, and `str(x)` force a read as that
type.

### Annotations

The accessor picks the level. The wrong level compiles and matches nothing.

| Accessor | Matches annotations on |
| --- | --- |
| `annotations['name']` | the span itself |
| `evals['name']` | the span itself (legacy alias) |
| `trace_annotations['name']` | the span's containing trace |

`trace_annotations[...]` matches every span of an annotated trace. Add `parent_id is None` to
get one row per trace. Discover names with `Project.spanAnnotationNames` and
`Project.traceAnnotationsNames`.

### Spellings that compile and match nothing

Unknown names fall back to attribute paths, so these are not errors.

| Wrote | Phoenix reads | Write instead |
| --- | --- | --- |
| `span_kind == LLM` | attribute named `LLM` | `span_kind == 'LLM'` |
| `parent_id == null` | attribute named `null` | `parent_id is None` |
| `error_count > 0`, `num_spans > 3`, `token_count_total > 0` | attributes; these are trace filter names | `traceFilterCondition`, or `status_code == 'ERROR'` for the span |
| `'refund' in input`, `output is None` | the `input` / `output` attribute objects | `'refund' in input.value`, `output.value is None` |
| `annotations.q.label == 'x'` | attribute path `annotations.q.label` | `annotations['q'].label == 'x'` |
| `attributes.llm.model_name == 'x'` | attribute named `attributes` | `llm.model_name == 'x'` |
| `is_root == True`, `user_id == 'u1'` | attributes | `parent_id is None`, `user.id == 'u1'` |

### Examples

```python span-filter
parent_id is None
parent_span is None
parent_id is None and status_code == "ERROR"
parent_id is None and latency_ms > 5000
span_kind == "LLM" and "gpt-4o" in llm.model_name
span_kind in ["LLM", "RETRIEVER"]
span_kind == "TOOL" and tool.name == "search"
status_code == "ERROR" and "timeout" in status_message
"refund" in input.value
"refund" in input.value or "refund" in output.value
output.value is None
metadata["topic"] == "billing"
metadata["tier"] != "premium" or metadata["tier"] is None
user.id == "u1"
float(metadata["retry_count"]) > 1
"true" in str(metadata["flag"])
attributes["tags"][0] == "urgent"
start_time > "2026-09-01T00:00:00Z" and end_time < "2026-09-02T00:00:00Z"
500 < latency_ms <= 2000
cumulative_llm_token_count_total > 10000
llm.token_count.total > 4000
total_cost > 0.01
any(d.token_type == "input" and d.tokens > 1000 for d in cost_details)
sum(d.cost for d in cost_details) > 0.01
annotations["correctness"].label == "incorrect"
annotations["hallucination"].score > 0.5
annotations["correctness"].label is None
annotations["correctness"]
evals["correctness"].label == "incorrect"
trace_annotations["quality"].label == "poor"
parent_id is None and trace_annotations["quality"].score < 0.5
not span_kind == "LLM"
span_kind == "LLM" and (latency_ms > 5000 or status_code == "ERROR")
```

## Trace filter

Matches whole traces. Names are strict: an unknown name is rejected with a "did you mean"
suggestion. Span filter names (`span_kind`, `status_code`, `parent_id`, `input.value`) are
unknown here. Ask span-level questions with a comprehension over `spans`.

### Vocabulary

| Name | Type | Notes |
| --- | --- | --- |
| `trace_id` | string | |
| `start_time`, `end_time` | datetime | |
| `latency_ms` | number | |
| `num_spans`, `error_count`, `tool_span_count`, `llm_span_count` | number | rollups; `0` when empty, never null |
| `token_count_prompt`, `token_count_completion`, `token_count_total` | number | rollups |
| `prompt_cost`, `completion_cost`, `total_cost` | number | rollups |
| `input`, `output` | string | the root span's I/O text: `'refund' in input`, `output is None` |
| `user.id` | string | the root span's user id; the only dotted name |
| `metadata['k']`, `attributes['k']` | attribute | read from the root span; `attributes["input.value"]` for any other root attribute |
| `trace_annotations['name']` | annotation | `annotations[...]` is rejected here |
| `spans` | collection | element fields: `name`, `parent_id`, `span_kind`, `status_code`, `start_time`, `end_time`, `latency_ms`, `llm_token_count_prompt`, `llm_token_count_completion`, `llm_token_count_total`, `cumulative_error_count`, `cumulative_llm_token_count_prompt`, `cumulative_llm_token_count_completion`, `cumulative_llm_token_count_total`; relations `parent_span` (traversable), `children`, `siblings`, `annotations`, `cost_details` |
| `trace_annotations`, `span_annotations` | collection | elements have `name`, `label`, `score`, `identifier` |
| `span_cost_details` | collection | elements have `token_type`, `is_prompt`, `cost`, `tokens`, `cost_per_token` |

Root-span reads (`input`, `output`, `user.id`, `metadata`, `attributes`) bind to the
representative root span the traces table displays. Inside a comprehension, reference only the
loop variable's fields.

### Examples

```python trace-filter
error_count > 0 and latency_ms > 1000
num_spans > 10 and total_cost > 0.25
"refund" in input
output is None
user.id == "u1"
metadata["topic"] == "support"
attributes["llm.model_name"] == "gpt-4o"
trace_annotations["quality"].score < 0.5
start_time >= "2026-07-01T00:00:00Z"
any(span.status_code == "ERROR" for span in spans)
any(span.span_kind == "LLM" and span.latency_ms > 5000 for span in spans)
any(span.parent_span is None and span.status_code == "ERROR" for span in spans)
any(span.parent_span.span_kind == "LLM" and span.span_kind == "TOOL" for span in spans)
any(annotation.label == "hallucinated" for annotation in span_annotations)
len([span for span in spans if span.span_kind == "TOOL"]) > 3
sum(detail.cost for detail in span_cost_details if detail.is_prompt) > 0.10
```

## Session filter

Matches sessions. A session is one conversation, and each trace in it is usually one turn.
Names are strict, as in the trace filter.

### Vocabulary

| Name | Type | Notes |
| --- | --- | --- |
| `session_id` | string | |
| `start_time`, `end_time` | datetime | |
| `duration_ms` | number | |
| `num_traces`, `num_traces_with_error`, `tool_span_count`, `llm_span_count` | number | rollups; `0` when empty |
| `token_count_prompt`, `token_count_completion`, `token_count_total` | number | rollups |
| `prompt_cost`, `completion_cost`, `total_cost` | number | rollups |
| `first_input`, `last_output` | string | the opening input and final output; `==`, `in`, `is None` |
| `any_input`, `any_output` | containment only | `'refund' in any_input`; never `any_input == ...` |
| `user.id`, `metadata['k']`, `attributes['k']` | attribute | read from the session's root spans |
| `session_annotations['name']` | annotation | |
| `traces` | collection | elements have `start_time`, `end_time`, `latency_ms`, and their own `spans` |
| `spans`, `session_annotations`, `span_annotations`, `span_cost_details` | collection | as in the trace filter |

### Examples

```python session-filter
num_traces > 5 and total_cost > 0.50
num_traces_with_error / num_traces > 0.2
duration_ms > 60000
"refund" in any_input
last_output is not None
session_annotations["Quality"].score <= 0.5
any(span.status_code == "ERROR" for span in spans)
all(trace.latency_ms < 30000 for trace in traces)
any(len([span for span in trace.spans if span.span_kind == "TOOL"]) > 5 for trace in traces)
```

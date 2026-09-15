# Filter expressions

A filter condition is a **Python boolean expression** that Phoenix compiles to SQL. Phoenix has three filter languages, one per grain, and **the argument name picks the language**. Their vocabularies do not mix: a trace-grain name in a span filter compiles as an attribute path and silently matches nothing, and a span-grain name in a trace filter is rejected.

| Argument | Grain | Keeps | Accepted on |
| --- | --- | --- | --- |
| `filterCondition` | span | individual spans | `Project.spans`, `Trace.spans`, project aggregates (`recordCount`, `tokenCountTotal`, `costSummary`, `latencyMsQuantile`, ...), `SpanQuery().where(...)` in the Python client, the UI spans filter bar |
| `traceFilterCondition` | trace | every span of a matching trace | `Project.spans`, the UI traces filter bar, the REST `filter` param on `GET /v1/projects/{id}/traces` |
| `sessionFilterCondition` | session | sessions | `Project.sessions`, project aggregates, the UI sessions filter bar |

`filterCondition` and `traceFilterCondition` compose on `Project.spans` (matching spans inside matching traces). `filterCondition` and `sessionFilterCondition` are mutually exclusive on aggregates that accept both.

Validate before running: `validateSpanFilterCondition(condition:)`, `validateTraceFilterCondition(condition:)`, `validateSessionFilterCondition(condition:)` on `Project` return `{ isValid errorMessage }`. Discover names: `traceFilterVocabulary` and `sessionFilterVocabulary` on `Project` list every bindable name (`name type category description iterableName`). The span grain has no vocabulary field; its names are listed exhaustively below.

## Span filter (`filterCondition`)

### Root spans

There is no `traces` connection and no root-span argument: root-span scoping is a clause in `filterCondition`.

| Clause | Keeps | Use when |
| --- | --- | --- |
| `parent_id is None` | spans with no parent id | the default: the trace's recorded entry span(s) |
| `parent_span is None` | those, plus **orphans** (parent id set, parent span never received) | you want every top-level span, including ones whose parent was dropped |

A root span is *usually* one per trace; fragmented traces can have several. Root clauses compose with everything else: `parent_id is None and status_code == 'ERROR'`.

### Vocabulary (exhaustive)

| Name | Type | Notes |
| --- | --- | --- |
| `span_id`, `trace_id`, `parent_id` | string | OpenTelemetry hex ids; `parent_id is None` for roots |
| `name` | string | span name; `'chat' in name` for substring search (case-insensitive) |
| `span_kind` | string enum | `'CHAIN'`, `'LLM'`, `'RETRIEVER'`, `'EMBEDDING'`, `'TOOL'`, `'AGENT'`, `'RERANKER'`, `'GUARDRAIL'`, `'EVALUATOR'`, `'PROMPT'`, `'UNKNOWN'`; literals are uppercased for you |
| `status_code` | string enum | `'OK'`, `'ERROR'`, `'UNSET'`; literals are uppercased for you |
| `status_message` | string | error text; `'timeout' in status_message` |
| `latency_ms` | number | |
| `start_time`, `end_time` | datetime | compare against an ISO 8601 literal **with an offset** |
| `cumulative_llm_token_count_prompt`, `cumulative_llm_token_count_completion`, `cumulative_llm_token_count_total` | number | this span plus its descendants |
| `llm.token_count.prompt`, `llm.token_count.completion`, `llm.token_count.total` | number | this span alone (attribute, cast to a number) |
| `total_cost`, `prompt_cost`, `completion_cost` | number | this span's cost row; `0` when it has none |
| `cost_details` | collection | iterable only; elements have `token_type` (string), `is_prompt` (boolean), `cost`, `tokens`, `cost_per_token` (number) |
| `parent_span` | reserved | **only** `is None` / `is not None`; `parent_span.name` is rejected |
| `annotations['name']`, `evals['name']` | annotation | on the span itself; `evals` is a legacy alias |
| `trace_annotations['name']` | annotation | on the span's containing trace |
| `attributes[...]`, `metadata[...]`, any other dotted name | attribute | JSON attribute path, type unknown until read |

Legacy spellings still accepted: `context.span_id`, `context.trace_id`, `cumulative_token_count.prompt|completion|total`.

**Every other identifier is an attribute path.** That is how `llm.model_name` and `input.value` work, and it is also why a mistake compiles and returns nothing instead of erroring. Names that look right but silently match nothing in a span filter: `error_count`, `num_spans`, `token_count_total`, `input`, `output`, `user_id`, `is_root`, `null`, an unquoted string (`span_kind == LLM` reads `LLM` as an attribute), `annotations.q.label` (must be subscripted), and `attributes.llm.model_name` (must be `attributes['llm.model_name']` or `llm.model_name`).

### Attributes, input, output

- Span input/output text lives at `input.value` and `output.value` (`input.mime_type`, `output.mime_type` for the type). `'refund' in output.value` is the substring search; `output.value is None` finds spans without output. Bare `input` / `output` is the **trace** filter's spelling and is not what you want here.
- These are the same attribute: `llm.model_name`, `attributes['llm.model_name']`, `attributes['llm']['model_name']`. `metadata['k']` is shorthand for `attributes['metadata']['k']`. Integer subscripts index JSON arrays: `attributes['tags'][0]`.
- An attribute's type is unknown until read. Compared against a number it is cast to a number, against `True`/`False` to a boolean, otherwise compared as text. Rows whose value cannot be cast drop out rather than erroring. `float(x)` / `int(x)` force a numeric read, `str(x)` a text read; these three are the **only** functions allowed.
- Equality between a JSON attribute and a string literal is exact and backend-dependent for non-string JSON values; substring `in` is the portable way to search text.

### Annotations

| Accessor | Matches annotations on | Written by |
| --- | --- | --- |
| `annotations['name']` | the span itself | span annotations, span notes (`name == 'note'`) |
| `evals['name']` | the span itself (legacy alias of `annotations`) | same |
| `trace_annotations['name']` | the span's containing **trace** | trace annotations, trace notes |

Each exposes `.label` (string), `.score` (number), `.explanation` (string), and `.identifier` (string). The bare accessor (`annotations['quality']`) is an existence check. **The accessor picks the level, and the wrong level fails silently**: `annotations['quality']` matches nothing when `quality` was written on the trace. `trace_annotations[...]` matches every span of an annotated trace, so add `parent_id is None` to get one row per trace. Discover names with `Project.spanAnnotationNames` and `Project.traceAnnotationsNames` first.

### Operators and literals

| Category | Accepted | Rejected |
| --- | --- | --- |
| Comparison | `==` `!=` `<` `<=` `>` `>=`, chained (`500 < latency_ms <= 2000`) | `=` |
| Missing values | `is None`, `is not None` (also `== None`) | `is null`, `null`, `is` with any other value |
| Membership | `x in [...]` (exact), `'text' in field` (case-insensitive substring), `not in` | `None` inside a list, a literal on the left (`1 in [1, 2]`), `like` |
| Logic | `and`, `or`, `not`, parentheses | `&&`, `\|\|`, `&`, `\|`, `!` |
| Arithmetic | `+` `-` `*` `/` `%` on numbers | `**`, `//`, bitwise operators |
| Calls | `float(x)`, `int(x)`, `str(x)`; `any` / `all` / `len` / `sum` / `max` / `min` over `cost_details` only | method calls (`name.startswith(...)`), `len(name)`, `bool(x)`, anything else |
| Strings | single or double quotes | unquoted |
| Numbers | unquoted: `latency_ms > 100` | quoted: `latency_ms > '100'` is rejected |
| Datetimes | ISO 8601 string with offset: `start_time > '2026-09-01T00:00:00Z'` | no offset |
| Booleans | `True`, `False` as operands (`metadata['flag'] == True`) | `true`, `false`; a bare `True` as the whole condition |

Rules that differ from Python:

- **Missing values fail every comparison, including `!=`.** A span without `metadata['tier']` matches neither `metadata['tier'] == 'premium'` nor `metadata['tier'] != 'premium'`. Spell the missing case out: `metadata['tier'] != 'premium' or metadata['tier'] is None`.
- **Every operand of `and` / `or` / `not` must itself be a condition.** `name == 'x' and metadata['flag']` is rejected; write `metadata['flag'] == True`. The only bare operands allowed are annotation existence checks and `True` / `False`.
- **Enum case folds, text does not.** `span_kind == 'llm'` matches `LLM`; `name == 'llm'` is case-sensitive. Substring `in` ignores case everywhere.
- **Unknown names never error.** Check spelling against the vocabulary above, or run `validateSpanFilterCondition` and then a small `first: 5` query to confirm the filter matches anything.

### Examples

Every line compiles as a span filter:

```python span-filter
parent_id is None
parent_span is None
parent_id is None and status_code == 'ERROR'
parent_id is None and latency_ms > 5000
span_kind == 'LLM' and 'gpt-4o' in llm.model_name
span_kind in ['LLM', 'RETRIEVER']
span_kind == 'TOOL' and tool.name == 'search'
status_code == 'ERROR' and 'timeout' in status_message
'refund' in input.value
'refund' in input.value or 'refund' in output.value
output.value is None
metadata['topic'] == 'billing'
metadata['tier'] != 'premium' or metadata['tier'] is None
user.id == 'u1'
float(metadata['retry_count']) > 1
'true' in str(metadata['flag'])
attributes['tags'][0] == 'urgent'
start_time > '2026-09-01T00:00:00Z' and end_time < '2026-09-02T00:00:00Z'
500 < latency_ms <= 2000
cumulative_llm_token_count_total > 10000
llm.token_count.total > 4000
total_cost > 0.01
any(d.token_type == 'input' and d.tokens > 1000 for d in cost_details)
sum(d.cost for d in cost_details) > 0.01
annotations['correctness'].label == 'incorrect'
annotations['hallucination'].score > 0.5
annotations['correctness'].label is None
annotations['correctness']
evals['correctness'].label == 'incorrect'
trace_annotations['quality'].label == 'poor'
parent_id is None and trace_annotations['quality'].score < 0.5
not span_kind == 'LLM'
span_kind == 'LLM' and (latency_ms > 5000 or status_code == 'ERROR')
```

## Trace filter (`traceFilterCondition`)

Matches whole traces. Names are **strict**: an unknown name is rejected with a `did you mean` suggestion, so a span-grain name (`span_kind`, `status_code`, `parent_id`) is an error here, not a silent miss. Use comprehensions over `spans` for span-level questions.

- Intrinsics: `trace_id`, `start_time`, `end_time`, `latency_ms`.
- Rollups, `0` when empty (never null): `num_spans`, `error_count`, `token_count_prompt`, `token_count_completion`, `token_count_total`, `prompt_cost`, `completion_cost`, `total_cost`, `tool_span_count`, `llm_span_count`.
- Root-span reads, bound to the representative root span the traces table displays: `input`, `output` (bare, as text: `'refund' in input`, `output is None`), `user.id` (the only dotted name), `metadata['k']`, `attributes['llm.model_name']`. `input.value` is rejected; read any other root attribute as `attributes["input.value"]`.
- Trace annotations: `trace_annotations['name']` with `.label` / `.score` / `.explanation`, or bare for existence. `annotations[...]` is rejected.
- Collections for `any` / `all` / `len` / `sum` / `max` / `min`: `spans`, `trace_annotations`, `span_annotations`, `span_cost_details`. A `spans` element exposes `name`, `parent_id`, `span_kind`, `status_code`, `start_time`, `end_time`, `latency_ms`, `llm_token_count_prompt|completion|total`, `cumulative_error_count`, `cumulative_llm_token_count_prompt|completion|total`, and the relations `parent_span` (traversable here), `children`, `siblings`, `annotations`, `cost_details`. Inside a comprehension, reference only the loop variable's fields.

```python trace-filter
error_count > 0 and latency_ms > 1000
num_spans > 10 and total_cost > 0.25
'refund' in input
output is None
user.id == 'u1'
metadata['topic'] == 'support'
attributes['llm.model_name'] == 'gpt-4o'
trace_annotations['quality'].score < 0.5
start_time >= '2026-07-01T00:00:00Z'
any(span.status_code == 'ERROR' for span in spans)
any(span.span_kind == 'LLM' and span.latency_ms > 5000 for span in spans)
any(span.parent_span is None and span.status_code == 'ERROR' for span in spans)
any(span.parent_span.span_kind == 'LLM' and span.span_kind == 'TOOL' for span in spans)
any(annotation.label == 'hallucinated' for annotation in span_annotations)
len([span for span in spans if span.span_kind == 'TOOL']) > 3
sum(detail.cost for detail in span_cost_details if detail.is_prompt) > 0.10
```

## Session filter (`sessionFilterCondition`)

Matches sessions (one conversation; each trace is usually one turn). Names are strict, as in the trace filter. Aggregates are `0` when empty: `num_traces`, `num_traces_with_error`, `duration_ms`, `token_count_prompt|completion|total`, `prompt_cost`, `completion_cost`, `total_cost`, `tool_span_count`, `llm_span_count`; intrinsics `session_id`, `start_time`, `end_time`. Text: `first_input`, `last_output` are values (`==`, `in`, `is None`); `any_input`, `any_output` are containment tests only (`'refund' in any_input`, never `any_input == ...`). Annotations: `session_annotations['name'].label|.score|.explanation`. Collections: `spans`, `traces` (each with its own `.spans`), `session_annotations`, `span_annotations`, `span_cost_details`.

```python session-filter
num_traces > 5 and total_cost > 0.50
num_traces_with_error / num_traces > 0.2
'refund' in any_input
last_output is not None
session_annotations['Quality'].score <= 0.5
any(span.status_code == 'ERROR' for span in spans)
all(trace.latency_ms < 30000 for trace in traces)
any(len([span for span in trace.spans if span.span_kind == 'TOOL']) > 5 for trace in traces)
```

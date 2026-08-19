# Trace Filter DSL

The trace filter DSL selects trace rows with a small Python expression, for example:

```python
error_count > 0 and any(span.span_kind == "LLM" for span in spans)
```

It belongs to the same language family as the [span filter DSL](./span-filter-dsl.md) and
the [session filter DSL](./session-filter-dsl.md). Those specifications define the shared
expression grammar, type checking, missing-value behavior, case handling, annotation access,
and Python-to-SQL correspondence. This document records only the trace grain's additions and
intentional differences.

Core modules:

- `src/phoenix/trace/dsl/filter.py` — the shared compiler
- `src/phoenix/trace/dsl/trace_filter.py` — trace bindings and query assembly
- `src/phoenix/db/trace_aggregates.py` — trace aggregate and displayed-root subqueries

## Scope

`traceFilterCondition` filters rows in the traces table. In this contract it does not filter
project metrics, chart series, evaluation summaries, or count cards. Those surfaces retain
their existing project and time-range scopes. A future cross-surface filter must be introduced
explicitly rather than inferred from this table argument.

## Trace Fields and Aggregates

Direct fields are `trace_id`, `start_time`, `end_time`, and `latency_ms`. Per-trace aggregates
include span count, error count, token counts, costs, and counts for common span kinds. Empty
aggregates are `0`, following the shared session-grain rule.

Datetime comparands are ISO 8601 strings with an explicit offset, for example
`start_time >= "2026-07-01T00:00:00Z"` or
`start_time >= "2026-07-01T00:00:00+00:00"`. A naive datetime literal is rejected.

## Displayed Root Contract

Top-level `input`, `output`, `user.id`, `metadata[...]`, and `attributes[...]` all read from
the same representative span shown in the traces table under the selected root policy. This
is the "search what you see" rule: predicates must not bind to a different root definition
than the displayed row. The vocabulary has no root-policy argument and reflects the default
orphan-aware policy.

By default, the representative is chosen from the trace's orphan-aware root candidates:

1. a span whose `parent_id` is null, or
2. a span whose `parent_id` has no matching span in the same trace.

An ID match in another trace does not make a candidate non-orphan.
When `orphanSpanAsRootSpan` is false, only candidates with a null `parent_id` are considered.
Candidates are ranked by `start_time ASC, id DESC`, and the first is displayed and bound.
The `id` tie-break makes malformed traces with several candidates deterministic. A trace with
no candidate has no displayed-root values.

Input, output, and attribute reads use the wire-key candidate-path rules defined by the
session grain. Flat and nested ingestion forms such as `input.value` and
`{"input": {"value": ...}}` therefore resolve identically, including when an `input` prefix
key is stored beside `input.value`.

## Span Collection

`spans` contains every stored span in the trace. It supports `any`, `all`, `len`, `sum`,
`max`, and `min`, including filtered and nested comprehensions. `max` and `min` accept both
numeric and datetime fields. Empty reductions are missing, and comparisons against them are
false except for explicit `is None` checks, as defined by the shared family rules.

The cumulative fields on a span are ingestion-time subtree rollups:

- `cumulative_error_count` counts ERROR spans at or below that span.
- `cumulative_llm_token_count_prompt`, `...completion`, and `...total` sum LLM token counts at
  or below that span.

"Below" follows stored parent edges within the same trace. It does not infer ancestry across
traces when OpenTelemetry span IDs collide or an orphan points at a span stored elsewhere.

## Parent and Nested Relationships

`span.parent_span` traverses to the direct stored parent in the same trace. It is missing for
both a null parent ID and an orphan whose parent row was not ingested. Parent existence is
therefore expressible directly:

```python
any(span.parent_span is None for span in spans)
any(span.parent_span is not None for span in spans)
```

A direct child of a stored trace root is distinct from an orphan and is written:

```python
any(span.parent_span is not None and span.parent_span.parent_id is None for span in spans)
```

Traversal exposes the parent's ordinary fields, including enum and datetime coercion:

```python
any(span.parent_span.span_kind == "LLM" for span in spans)
any(span.parent_span.start_time >= "2026-07-01T00:00:00Z" for span in spans)
```

`span.children` contains spans in the same trace whose `parent_id` equals the span's
`span_id`. `span.siblings` contains other children of the same stored parent; two orphans
that share a dangling `parent_id` are not siblings. `span.annotations` and
`span.cost_details` correlate by the stored span row ID. Every nested relationship includes
the owning trace or row key as well as the OpenTelemetry edge, so identifier collisions in
another trace cannot leak elements into a predicate.

## Query Lowering

Both `Project.spans` query paths use probe lowering: the trace-start-time paginator and the
general span listing are limited page queries, so correlated predicates can stop after
satisfying the limit. Aggregate subqueries remain bounded by the candidate project, time
range, and trace IDs. Scan lowering remains the helper default for future unbounded analytical
callers; both lowerings must agree with the Python reference evaluator.

Filtering composes with the existing trace paginator before representative-root selection.
It therefore preserves one edge per trace, trace-start-time window semantics, cursor behavior,
and the paginator's retry behavior.

## Compatibility Notes

`parent_span` is the relationship name across the filter family. The trace grammar has no
legacy `parent` spelling because it shipped before stored trace conditions existed.

The shared comprehension validator also rejects an outer-element reference when nesting puts
that element outside the permitted scope. Earlier session-filter construction could accept
such an expression and then silently bind the name to the inner element. Rejecting the
expression is a user-visible correctness repair: accepted conditions no longer change meaning
during SQL construction.

# Project, Span, Trace

## Project

- `Project.spans(timeRange, first, after, sort: SpanSort, filterCondition: String, traceFilterCondition: String)` → connection of `Span`. There is **no `traces` connection on `Project`** — use `filterCondition: "parent_span is None"` for root spans, one per trace. There is no `rootSpansOnly` argument; root-span scoping lives in the filter expression.
- `Project.trace(traceId: ID!)` → `Trace` — lookup by OTel hex trace id.
- Aggregates, most accepting `timeRange` and `filterCondition`: `traceCount`, `recordCount` (span count), `tokenCountTotal`, `tokenCountPrompt`, `tokenCountCompletion`, `costSummary`, `latencyMsQuantile(probability: Float!)`, `spanLatencyMsQuantile(probability: Float!)`.
- Discovery fields: `spanAnnotationNames`, `traceAnnotationsNames`, `spanAnnotationSummary`, `documentEvaluationNames` — check which evals/annotations exist before querying them.
- `validateSpanFilterCondition(condition: String!)` — check a filter string without running it.
- Root-span predicates: `parent_span is None` treats a span whose parent was never ingested as a root; `parent_id is None` matches only spans that carry no parent pointer. Either one **on its own** selects one span per trace (the trace's displayed root), so the row count is a trace count; conjoin anything else and it becomes an ordinary filter over every root span.
- `filterCondition` is a span filter expression. The user-facing grammar reference (operators, attribute/annotation access, substring search, `is None`) is the [Filter Expressions](https://arize.com/docs/phoenix/tracing/how-to-tracing/filter-expressions) doc; the enforced grammar lives in `internal_docs/specs/span-filter-dsl.md`.

## Span

Key fields: `spanId` (OTel hex), `name`, `spanKind`, `statusCode`, `startTime`, `latencyMs`, `cumulativeTokenCountTotal`, `input { truncatedValue value }`, `output { truncatedValue value }`, `spanAnnotations { name label score }`, `trace { traceId }`. **`Span` has no `traceId` field** — read the OTel trace id via the nested `trace { traceId }`.

## Trace

Key fields: `traceId`, `latencyMs`, `numSpans`, `rootSpan { ... }` (the entry span — use it for a one-line turn/trace summary), `spans(first, after)`, `projectSessionId`.

## Examples

Recent root spans (one per trace), slowest first:

```graphql
query RecentTraces($id: ID!, $first: Int = 20) {
  node(id: $id) {
    ... on Project {
      spans(
        first: $first
        filterCondition: "parent_span is None"
        sort: { col: latencyMs, dir: desc }
      ) {
        edges {
          node {
            spanId
            name
            latencyMs
            statusCode
            startTime
            cumulativeTokenCountTotal
            trace { traceId }
          }
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
}
```

Filtered spans (error LLM spans):

```graphql
query ErrorSpans($id: ID!) {
  node(id: $id) {
    ... on Project {
      spans(first: 20, filterCondition: "span_kind == 'LLM' and status_code == 'ERROR'") {
        edges { node { spanId name statusCode trace { traceId } } }
      }
    }
  }
}
```

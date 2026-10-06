# Project, Span, Trace

## Project

- `Project.spans(first, after, timeRange, sort: SpanSort, filterCondition: String, traceFilterCondition: String)` → connection of `Span`. There is **no `traces` connection on `Project`** and no root-span argument: list traces with `spans(filterCondition: "parent_span is None")`, which keeps root spans including orphans whose parent was never received (what the UI's traces table runs), usually one per trace; `parent_id is None` keeps only spans with no parent id. Pair with `traceFilterCondition` to keep the roots of matching traces.
- `Project.trace(traceId: ID!)` → `Trace` — lookup by OTel hex trace id.
- Aggregates, most accepting `timeRange` and `filterCondition`: `traceCount`, `recordCount` (span count), `tokenCountTotal`, `tokenCountPrompt`, `tokenCountCompletion`, `costSummary`, `latencyMsQuantile(probability: Float!)`, `spanLatencyMsQuantile(probability: Float!)`.
- Discovery fields: `spanAnnotationNames`, `traceAnnotationNames`, `spanAnnotationSummary`, `documentEvaluationNames` — check which evals/annotations exist before querying them.
- `validateSpanFilterCondition(condition: String!)` — check a filter string without running it.
- `filterCondition` is a span filter expression and `traceFilterCondition` a trace filter expression; both languages are specified in `references/filter-expressions.md` (vocabulary, operators, root-span scoping, compiled examples).

## Span

Key fields: `spanId` (OTel hex), `name`, `spanKind`, `statusCode`, `startTime`, `latencyMs`, `cumulativeTokenCountTotal`, `input { truncatedValue value }`, `output { truncatedValue value }`, `spanAnnotations { name label score }`, `trace { traceId }`. **`Span` has no `traceId` field** — read the OTel trace id via the nested `trace { traceId }`.

## Trace

Key fields: `traceId`, `latencyMs`, `numSpans`, `rootSpan { ... }` (the representative root span: the earliest span with no parent, or whose parent was never received — use it for a one-line turn/trace summary), `spans(first, after, filterCondition)`, `projectSessionId`.

## Examples

Recent root spans (usually one per trace), slowest first:

```graphql
query RecentTraces($id: ID!, $first: Int = 20) {
  node(id: $id) {
    ... on Project {
      spans(first: $first, filterCondition: "parent_span is None", sort: { col: latencyMs, dir: desc }) {
        edges {
          node {
            spanId
            name
            latencyMs
            statusCode
            startTime
            cumulativeTokenCountTotal
            trace { traceId numSpans }
          }
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
}
```

Root spans of errored traces in a time window:

```graphql
query ErroredTraces($id: ID!, $timeRange: TimeRange) {
  node(id: $id) {
    ... on Project {
      spans(
        first: 20
        timeRange: $timeRange
        filterCondition: "parent_span is None"
        traceFilterCondition: "error_count > 0"
      ) {
        edges { node { name latencyMs input { truncatedValue } trace { traceId } } }
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

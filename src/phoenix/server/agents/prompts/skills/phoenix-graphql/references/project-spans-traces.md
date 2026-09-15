# Project, Span, Trace

## Project

- `Project.traces(first, after, timeRange, sort: SpanSort, traceFilterCondition: String)` → connection of `Trace`, one node per trace, newest first by default. Each node's `rootSpan` is the representative root span (the earliest span with no parent, or whose parent was never received); `sort` orders traces by a column of that span. The starting point for "list the traces that ...".
- `Project.spans(first, after, timeRange, sort: SpanSort, filterCondition: String, traceFilterCondition: String)` → connection of `Span`, for span-level questions. There is no root-span argument: `filterCondition: "parent_id is None"` keeps root spans, and `parent_span is None` also counts orphans.
- `Project.trace(traceId: ID!)` → `Trace` — lookup by OTel hex trace id.
- Aggregates, most accepting `timeRange` and `filterCondition`: `traceCount`, `recordCount` (span count), `tokenCountTotal`, `tokenCountPrompt`, `tokenCountCompletion`, `costSummary`, `latencyMsQuantile(probability: Float!)`, `spanLatencyMsQuantile(probability: Float!)`.
- Discovery fields: `spanAnnotationNames`, `traceAnnotationNames`, `spanAnnotationSummary`, `documentEvaluationNames` — check which evals/annotations exist before querying them.
- `validateSpanFilterCondition(condition: String!)` — check a filter string without running it.
- `filterCondition` is a span filter expression and `traceFilterCondition` a trace filter expression; both languages are specified in `references/filter-expressions.md` (vocabulary, operators, root-span scoping, compiled examples).

## Span

Key fields: `spanId` (OTel hex), `name`, `spanKind`, `statusCode`, `startTime`, `latencyMs`, `cumulativeTokenCountTotal`, `input { truncatedValue value }`, `output { truncatedValue value }`, `spanAnnotations { name label score }`, `trace { traceId }`. **`Span` has no `traceId` field** — read the OTel trace id via the nested `trace { traceId }`.

## Trace

Key fields: `traceId`, `latencyMs`, `numSpans`, `rootSpan { ... }` (the representative root span — use it for a one-line turn/trace summary), `spans(first, after, filterCondition)`, `projectSessionId`.

## Examples

Recent traces, slowest first, each summarized by its root span:

```graphql
query RecentTraces($id: ID!, $first: Int = 20) {
  node(id: $id) {
    ... on Project {
      traces(first: $first, sort: { col: latencyMs, dir: desc }) {
        edges {
          node {
            traceId
            latencyMs
            numSpans
            rootSpan {
              spanId
              name
              statusCode
              startTime
              cumulativeTokenCountTotal
            }
          }
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
}
```

Errored traces from the last hour:

```graphql
query ErroredTraces($id: ID!, $timeRange: TimeRange) {
  node(id: $id) {
    ... on Project {
      traces(first: 20, timeRange: $timeRange, traceFilterCondition: "error_count > 0") {
        edges { node { traceId latencyMs rootSpan { name input { truncatedValue } } } }
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

# Project, Span, Trace

## Project

- `Project.spans(timeRange, first, after, sort: SpanSort, rootSpansOnly: Boolean, filterCondition: String)` → connection of `Span`. There is **no `traces` connection on `Project`** — use `spans(rootSpansOnly: true)` for root spans, which is usually one per trace though nothing enforces that -- fragmented traces can have several.
- `Project.trace(traceId: ID!)` → `Trace` — lookup by OTel hex trace id.
- Aggregates, most accepting `timeRange` and `filterCondition`: `traceCount`, `recordCount` (span count), `tokenCountTotal`, `tokenCountPrompt`, `tokenCountCompletion`, `costSummary`, `latencyMsQuantile(probability: Float!)`, `spanLatencyMsQuantile(probability: Float!)`.
- Discovery fields: `spanAnnotationNames`, `traceAnnotationsNames`, `spanAnnotationSummary`, `documentEvaluationNames` — check which evals/annotations exist before querying them.
- `validateSpanFilterCondition(condition: String!)` — check a filter string without running it.

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
      spans(first: $first, rootSpansOnly: true, sort: { col: latencyMs, dir: desc }) {
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

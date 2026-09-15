# Project, Span, Trace

## Project

- `Project.spans(timeRange, first, after, sort: SpanSort, filterCondition: String, traceFilterCondition: String)` → connection of `Span`. There is **no `traces` connection on `Project`** — use `spans(filterCondition: "parent_id is None")` for root spans, usually one per trace though fragmented traces can have several. `parent_span is None` also counts orphans (spans whose parent was never received).
- `Project.trace(traceId: ID!)` → `Trace` — lookup by OTel hex trace id.
- Aggregates, most accepting `timeRange` and `filterCondition`: `traceCount`, `recordCount` (span count), `tokenCountTotal`, `tokenCountPrompt`, `tokenCountCompletion`, `costSummary`, `latencyMsQuantile(probability: Float!)`, `spanLatencyMsQuantile(probability: Float!)`.
- Discovery fields: `spanAnnotationNames`, `traceAnnotationNames`, `spanAnnotationSummary`, `documentEvaluationNames` — check which evals/annotations exist before querying them.
- `validateSpanFilterCondition(condition: String!)` — check a filter string without running it.
- `filterCondition` is a span filter expression and `traceFilterCondition` a trace filter expression; both languages are specified in `references/filter-expressions.md` (vocabulary, operators, root-span scoping, compiled examples).

## Span

Key fields: `spanId` (OTel hex), `name`, `spanKind`, `statusCode`, `startTime`, `latencyMs`, `cumulativeTokenCountTotal`, `input { truncatedValue value }`, `output { truncatedValue value }`, `spanAnnotations { name label score }`, `trace { traceId }`. **`Span` has no `traceId` field** — read the OTel trace id via the nested `trace { traceId }`.

## Trace

Key fields: `traceId`, `latencyMs`, `numSpans`, `rootSpan { ... }` (the entry span — use it for a one-line turn/trace summary), `spans(first, after)`, `projectSessionId`.

## Examples

Recent root spans (usually one per trace), slowest first:

```graphql
query RecentTraces($id: ID!, $first: Int = 20) {
  node(id: $id) {
    ... on Project {
      spans(first: $first, filterCondition: "parent_id is None", sort: { col: latencyMs, dir: desc }) {
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

# ProjectSession

A session groups the traces of one multi-turn conversation.

## Reaching a session

- `Project.sessions(timeRange, first, after, sort, sessionFilterCondition)` → connection of `ProjectSession`. `sessionFilterCondition` is a session filter expression; discover its bindable names via `Project.sessionFilterVocabulary` and check one with `Project.validateSessionFilterCondition`. The user-facing grammar reference (aggregates, comprehensions, annotations, root-span access) is the [Filter Expressions](https://arize.com/docs/phoenix/tracing/how-to-tracing/filter-expressions) doc; the enforced grammar lives in `internal_docs/specs/session-filter-dsl.md`.
- `getProjectSessionById(sessionId: String!)` → `ProjectSession` — `sessionId` is the raw session string, not a global id.

## Fields

- `sessionId`, `startTime`, `endTime`, `project`
- `numTraces`, `numTracesWithError`
- `firstInput { value }`, `lastOutput { value }`
- `tokenUsage { prompt completion total }` — each is a `Float`
- `costSummary { total { cost tokens } prompt { cost tokens } completion { cost tokens } }`, `costDetailSummaryEntries`
- `traceLatencyMsQuantile(probability: Float!)` — the percentile field (not `latency`)
- `traces(first, after)` — forward-only; `first` is effectively required. Summarize each turn via the trace's `rootSpan { name input { truncatedValue } output { truncatedValue } }`.
- `sessionAnnotations { name label score }`, `sessionAnnotationSummaries(filter)`

## Example

One round trip: session rollups plus a per-turn summary read from each trace's root span.

```graphql
query SessionDetail($id: ID!) {
  node(id: $id) {
    ... on ProjectSession {
      sessionId
      numTraces
      numTracesWithError
      tokenUsage { total }
      costSummary { total { cost tokens } }
      p50: traceLatencyMsQuantile(probability: 0.5)
      traces(first: 20) {
        edges {
          node {
            traceId
            latencyMs
            numSpans
            rootSpan {
              spanId
              name
              statusCode
              input { truncatedValue }
              output { truncatedValue }
            }
          }
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
}
```

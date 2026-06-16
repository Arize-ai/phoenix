# ProjectSession

A session groups the traces of one multi-turn conversation.

## Reaching a session

- `Project.sessions(timeRange, first, after, sort, filterIoSubstring, sessionId)` → connection of `ProjectSession`.
- `getProjectSessionById(sessionId: String!)` → `ProjectSession` — `sessionId` is the raw session string, not a global id.

## Fields

- `sessionId`, `startTime`, `endTime`, `project`
- `numTraces`, `numTracesWithError`
- `firstInput { value }`, `lastOutput { value }`
- `tokenUsage { prompt completion }`
- `costSummary`, `costDetailSummaryEntries`
- `traceLatencyMsQuantile(probability: Float!)` — the percentile field (not `latency`)
- `traces(first, after)` — forward-only; `first` is effectively required
- `sessionAnnotations { name label score }`, `sessionAnnotationSummaries(filter)`

## Example

```graphql
query SessionDetail($id: ID!) {
  node(id: $id) {
    ... on ProjectSession {
      sessionId
      numTraces
      numTracesWithError
      tokenUsage { prompt completion }
      p50: traceLatencyMsQuantile(probability: 0.5)
      traces(first: 20) {
        edges { node { traceId latencyMs numSpans } }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
}
```

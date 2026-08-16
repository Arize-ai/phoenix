# Annotations

Annotations are named labels/scores attached to spans, traces, or experiment runs by humans, code, or LLM judges.

## Fields

`SpanAnnotation` and `TraceAnnotation` share these fields:

- `name`, `label`, `score`, `explanation`
- `annotatorKind` (`AnnotatorKind` enum: human / LLM / code)
- `metadata`, `identifier`, `createdAt`, `updatedAt`

`SpanAnnotation` additionally has `spanId: GlobalID!` and `span`; `TraceAnnotation` has `trace` (but no `traceId` global-id field).

`ExperimentRunAnnotation` has the same scalar shape plus `error: String`, and uses `startTime`/`endTime` instead of `createdAt`/`updatedAt`.

## Reading annotations

- Per span: `Span.spanAnnotations { name label score explanation annotatorKind }`.
- Project-wide discovery and rollups: `Project.spanAnnotationNames`, `Project.spanAnnotationSummary`, `Project.traceAnnotationsNames`, `Project.traceAnnotationSummary` — use these to learn which annotation names exist before drilling in.
- In a span `filterCondition`, reference span annotations as `annotations['<name>'].label` / `.score` / `.explanation` (or the legacy `evals['<name>']`). Use the bare `annotations['<name>']` form to test existence.
- Reference trace annotations as `trace_annotations['<name>'].label` / `.score` / `.explanation`, or use the bare form to test existence. A match returns spans belonging to the annotated trace; combine with `rootSpansOnly: true` to return one root span per matching trace.

## Example

Spans that an LLM judge labelled as hallucinated, with the annotation detail:

```graphql
query Hallucinations($id: ID!) {
  node(id: $id) {
    ... on Project {
      spans(first: 20, filterCondition: "annotations['Hallucination'].label == 'hallucinated'") {
        edges {
          node {
            spanId
            spanAnnotations { name label score explanation }
          }
        }
      }
    }
  }
}
```

Root spans for traces with a poor quality annotation:

```graphql
query PoorQualityTraces($id: ID!) {
  node(id: $id) {
    ... on Project {
      spans(
        first: 20
        rootSpansOnly: true
        filterCondition: "trace_annotations['quality'].label == 'poor'"
      ) {
        edges { node { spanId name trace { traceId } } }
      }
    }
  }
}
```

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
- In a span `filterCondition`, reference annotations as `annotations['<name>'].label` / `.score` (or the legacy `evals['<name>']`).

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

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

## Batch span annotation

`createSpanAnnotations` batch-upserts annotations keyed by `(name, span, identifier)`. Reusing the
same name and identifier on the same span updates in place; use a distinct identifier only when a
separate annotation is intended. Each item targets `spanId`, which is the span's Phoenix Relay node
ID. Do not pass the OpenTelemetry hex `Span.spanId` value there, and never mix the two ID formats.
Use stable lowercase snake_case names, consistent labels, and explanations for judgments.

```graphql
mutation BatchSpanAnnotate($input: [CreateSpanAnnotationInput!]!) {
  createSpanAnnotations(input: $input) {
    spanAnnotations { id spanId name label score explanation identifier }
  }
}
```

## Annotation config mutations

Read the project's existing configs first and reuse a matching rubric instead of creating a
near-duplicate. `AnnotationConfigInput` is a one-of input: provide exactly one of `categorical`,
`continuous`, or `freeform`. `updateAnnotationConfig` is a full replacement, not a patch: keep the
same name and type and include every existing value or bound that should remain.

```graphql
mutation CreateAnnotationConfig($input: CreateAnnotationConfigInput!) {
  createAnnotationConfig(input: $input) {
    annotationConfig {
      ... on Node { id }
      ... on AnnotationConfigBase { name annotationType }
    }
  }
}
```

Associate a newly created config to the in-view project's Relay node ID in a separate
`phoenix-gql` call using `addAnnotationConfigToProject`.

```graphql
mutation AddAnnotationConfigToProject($input: [AddAnnotationConfigToProjectInput!]!) {
  addAnnotationConfigToProject(input: $input) { project { id name } }
}
```

```graphql
mutation UpdateAnnotationConfig($input: UpdateAnnotationConfigInput!) {
  updateAnnotationConfig(input: $input) {
    annotationConfig {
      ... on Node { id }
      ... on AnnotationConfigBase { name annotationType }
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

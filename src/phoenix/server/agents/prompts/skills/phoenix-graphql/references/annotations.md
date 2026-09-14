# Annotations

Annotations are named labels/scores attached to spans, traces, sessions, or experiment runs by humans, code, or LLM judges. A **note** is an annotation with the reserved name `note` whose text lives in `explanation`; notes have their own mutations below.

## Fields

`SpanAnnotation` and `TraceAnnotation` share these fields:

- `name`, `label`, `score`, `explanation`
- `annotatorKind` (`AnnotatorKind` enum: human / LLM / code)
- `metadata`, `identifier`, `createdAt`, `updatedAt`

`SpanAnnotation` additionally has `spanId: GlobalID!` and `span`; `TraceAnnotation` has `trace` (but no `traceId` global-id field). `ProjectSessionAnnotation` has the same scalar shape.

`ExperimentRunAnnotation` has the same scalar shape plus `error: String`, and uses `startTime`/`endTime` instead of `createdAt`/`updatedAt`.

## Reading annotations

- Per span: `Span.spanAnnotations { name label score explanation annotatorKind identifier }`; notes alone via `Span.spanNotes { explanation identifier }`.
- Per trace / session: `Trace.traceAnnotations { ... }` and `ProjectSession.sessionAnnotations { ... }`; notes are the entries with `name == "note"`.
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

## Writing notes

Notes are free-text observations, one mutation per entity kind. Each input takes the entity by **either** its OpenTelemetry id or its Phoenix node id (never both), the text, `annotatorKind` (`LLM` for your own judgment, `HUMAN` only for one the user gave you), `source: API`, and an optional `identifier`. Passing the same `identifier` again for the same entity upserts the note instead of adding a second one; passing none creates a fresh note each time.

- `createSpanNotes(input: [CreateSpanNoteInput!]!)` — `{ span: { otelId } | { id }, note, annotatorKind, source, identifier }`
- `createTraceNotes(input: [CreateTraceNoteInput!]!)` — `{ trace: { otelId } | { id }, note, annotatorKind, source, identifier }`
- `createProjectSessionNotes(input: [CreateProjectSessionNoteInput!]!)` — `{ session: { sessionId } | { id }, note, annotatorKind, source, identifier }` where `sessionId` is the application's raw `session.id`

```graphql
mutation NoteTrace($traceId: String!, $note: String!, $identifier: String!) {
  createTraceNotes(
    input: [{ trace: { otelId: $traceId }, note: $note, annotatorKind: LLM, source: API, identifier: $identifier }]
  ) {
    traceAnnotations { id name explanation identifier }
  }
}
```

The mutation is synchronous: the row exists when the response returns. Batch several entities in one call by passing more inputs.

## Writing labels

Labelled annotations carry a `name` (the dimension) and a `label` (the outcome), optionally `score` and `explanation`. Their inputs take **Phoenix node ids only** — read `id` when sampling, not the OTel hex id — and require `metadata` (pass `{}`).

- `createSpanAnnotations(input: [CreateSpanAnnotationInput!]!)` — `{ spanId, name, label, score, explanation, annotatorKind, source: API, metadata: {}, identifier }`
- `createTraceAnnotations(input: [CreateTraceAnnotationInput!]!)` — same shape with `traceId`
- `createProjectSessionAnnotations(input: CreateProjectSessionAnnotationInput!)` — same shape with `projectSessionId`; takes a single input, not a list

Writes upsert on `(entity, name, identifier)`. `patchSpanAnnotations` / `patchTraceAnnotations` edit an existing annotation by its node id; `deleteSpanAnnotations`, `deleteTraceAnnotations`, and `deleteProjectSessionAnnotations` remove by node id — there is no filter-based sweep, so collect ids first (e.g. `Span.spanAnnotations { id identifier }`).

## Annotation configs

A categorical config makes a label set first-class in the UI (dropdown for annotators, shared vocabulary across runs). The annotation `name` and the config `name` must match.

- `createAnnotationConfig(input: { annotationConfig: { categorical: { name, description, optimizationDirection: NONE, values: [{ label }, ...] } } })` — `AnnotationConfigInput` is a `@oneOf` of `categorical`, `continuous`, `freeform`
- `updateAnnotationConfig(input: UpdateAnnotationConfigInput!)` — replace the values when a new category emerges
- `addAnnotationConfigToProject(input: [{ projectId, annotationConfigId }])` — attach it to the project so it appears there
- Discover existing configs with `Query.annotationConfigs` before creating a near-duplicate.


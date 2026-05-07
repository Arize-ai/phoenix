# Trace User Feedback Annotations

## Summary

Add `user_feedback` as a first-class trace annotation type for thumbs-up and
thumbs-down feedback. Feedback is represented as a trace annotation with:

- `name="user_feedback"`
- `annotator_kind="HUMAN"`
- `label="positive"` or `label="negative"`
- `score=1` for positive feedback and `score=0` for negative feedback

This plan covers server, GraphQL API, REST API, and annotation-config seeding.
It intentionally excludes UI work.

## Current State

Phoenix already models notes as special annotations with `name="note"`, but
notes are append-only. Each trace note creates a new `TraceAnnotation` row with
a generated `px-trace-note:<uuid4>` identifier. That is different from feedback,
which should behave like a toggle.

Trace annotations already have singleton behavior when `(name, trace_rowid,
identifier)` is stable. GraphQL app-owned annotations can already use
`get_user_identifier(user_id)` as a per-user identifier. That is the right
foundation for trace feedback.

PXI already has a frontend-only assistant-message feedback action that posts
generic `user_feedback` annotations through `/v1/trace_annotations` and
`/v1/span_annotations`. Because UI work is out of scope, the dedicated APIs
should be added without breaking that generic REST write path yet.

## API Contract

Feedback is per-user. Each authenticated user has at most one
`user_feedback` annotation per trace. Setting feedback again updates the same
row. Removing feedback deletes only the caller's feedback row for that trace.
In no-auth local mode, use one stable anonymous app identifier so feedback is
still a single row per trace.

Add dedicated GraphQL mutations:

- `setTraceUserFeedback(input: SetTraceUserFeedbackInput!): TraceUserFeedbackMutationPayload`
- `deleteTraceUserFeedback(input: DeleteTraceUserFeedbackInput!): TraceUserFeedbackMutationPayload`

Inputs identify the trace by Relay `Trace` ID. Set accepts only `positive` or
`negative`. Set returns the inserted or updated `TraceAnnotation`. Delete is
idempotent and returns `traceAnnotation: null` if no row existed.

Add dedicated REST endpoints:

- `PUT /v1/traces/{trace_identifier}/user_feedback`
- `DELETE /v1/traces/{trace_identifier}/user_feedback`

`trace_identifier` accepts either a Relay `Trace` ID or raw OpenTelemetry
`trace_id`, matching the existing trace delete route. PUT accepts:

```json
{
  "data": {
    "label": "positive"
  }
}
```

PUT returns the inserted or updated `TraceAnnotation` ID. DELETE returns `204`.

## Implementation Plan

Add shared backend constants and helpers for:

- the canonical annotation name, `user_feedback`
- the allowed labels, `positive` and `negative`
- the canonical score mapping
- the per-user identifier policy
- shared trace feedback upsert and delete behavior

The upsert helper should use dialect-aware `insert_on_conflict` against the
existing `(name, trace_rowid, identifier)` uniqueness constraint so repeated
clicks and concurrent requests update atomically instead of racing through a
select-then-insert flow. GraphQL app-owned feedback should write `source="APP"`;
the dedicated REST endpoint should write `source="API"` to match existing REST
annotation and note routes. Both surfaces should use `annotator_kind="HUMAN"`,
set `metadata_={}`, and emit `TraceAnnotationInsertEvent` when a row is
inserted or updated.

The delete helper should remove only the matching `user_feedback` row for the
resolved trace and caller identifier, emit `TraceAnnotationDeleteEvent` when a
row is deleted, and otherwise succeed without error.

Seed a canonical annotation config during startup through an idempotent
facilitator step, following the existing built-in evaluator sync pattern. The
step should create the config only when no `AnnotationConfig` named
`user_feedback` exists. If a config with that name already exists, leave it
unchanged; do not fail startup, warn, or repair the existing shape. When seeded,
the config should be a global categorical `AnnotationConfig` with values:

| Label | Score |
| ----- | ----- |
| `positive` | `1` |
| `negative` | `0` |

Use `optimization_direction=MAXIMIZE`.

Do not automatically associate this config with every project in this slice.
Future UI work can decide whether project association is needed.

Reserve `user_feedback` in annotation-config create/update/delete APIs so users
cannot overwrite or remove the built-in config. Keep generic annotation writes
with `name="user_feedback"` accepted for now because PXI already depends on
that path. A later UI/API cleanup can migrate PXI to the dedicated endpoints
and then fully reserve `user_feedback` like `note`.

REST endpoints should use the same read-only and viewer protections as trace
notes. The `PUT` route should also use `is_not_locked`, matching the existing
repo convention that locked-project guards apply to insert/update routes and not
DELETE routes. Add both new `PUT` and `DELETE` routes to
`_VIEWER_BLOCKED_WRITE_OPERATIONS` in `tests/integration/_helpers.py` so REST
endpoint coverage remains exhaustive.

## Test Plan

GraphQL tests:

- setting positive feedback creates a `TraceAnnotation`
- setting negative feedback for the same user and trace updates the same row
- different users create separate rows on the same trace
- deleting feedback removes only the caller's row
- deleting feedback is idempotent
- invalid trace IDs and invalid labels fail with clear errors

REST tests:

- PUT works with a raw trace ID
- PUT works with a Relay trace ID
- repeated PUT updates in place
- concurrent or repeated PUT requests resolve through atomic upsert semantics
- DELETE removes the caller's feedback and returns `204`
- DELETE returns `204` when no feedback exists
- missing traces return `404`
- invalid labels return a validation error
- viewers are blocked from PUT and DELETE

Config seeding tests:

- startup creates the `user_feedback` categorical config when absent
- startup sync is idempotent
- an existing `user_feedback` config is left unchanged, even if noncanonical
- annotation-config create, update, and delete APIs reject `user_feedback`

Compatibility tests:

- generic `POST /v1/trace_annotations?sync=true` with `name="user_feedback"`
  still succeeds for PXI-compatible payloads

Generated artifacts and verification:

- run `make graphql`
- run `make openapi`
- update the REST endpoint coverage helper for the new PUT and DELETE routes
- run targeted Python tests for trace annotation mutations, trace REST routes,
  annotation config routes and mutations, and facilitator seeding

## Assumptions

- `user_feedback` is trace-only for this work.
- No span or session dedicated feedback API is added.
- No UI changes are included.
- Generic `user_feedback` support remains temporarily for PXI compatibility.

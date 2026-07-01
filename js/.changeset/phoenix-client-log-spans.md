---
"@arizeai/phoenix-client": minor
---

Add `logSpans` to `@arizeai/phoenix-client/spans`, mirroring the Python client's `log_spans` API. It submits spans directly to a project using Phoenix's simplified span structure (the same shape returned by `getSpans`), without requiring OpenTelemetry. Throws a new `SpanCreationError` with `invalidSpans`/`duplicateSpans` details if any span in the request is invalid or a duplicate.

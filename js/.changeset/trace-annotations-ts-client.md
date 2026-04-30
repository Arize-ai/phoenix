---
"@arizeai/phoenix-client": minor
---

Add `addTraceAnnotation` and `logTraceAnnotations` to the `traces` subpath. Brings the TypeScript client to parity with the Python client by exposing the existing `/v1/trace_annotations` REST endpoint for structured (label/score/explanation) feedback on traces.

---
"@arizeai/phoenix-client": minor
---

Add `addTraceNote()` helper for creating trace notes via `POST /v1/trace_notes`. The call performs a preflight server-version check and throws a descriptive error when the connected Phoenix server is too old. Requires Phoenix server >= 14.13.0.

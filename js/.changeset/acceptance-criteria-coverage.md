---
"@arizeai/phoenix-client": patch
---

Acceptance criteria results now report `eligibleRunCount` (non-skipped runs in the suite) next to `sampleCount` (runs that logged the criterion's annotation), and the reporter shows coverage as `70 of 100 runs`. Pass/fail semantics are unchanged: a criterion is computed over the runs that logged its annotation.

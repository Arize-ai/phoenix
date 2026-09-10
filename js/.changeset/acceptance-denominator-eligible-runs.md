---
"@arizeai/phoenix-client": patch
---

Acceptance criteria now count every eligible (non-skipped) run in their denominator: runs that finish without logging a criterion's annotation count as not passing for `passRate` and as a score of `0` for `average`, instead of being silently dropped. This keeps a suite whose annotation is missing on most runs from passing at `minPassRate: 1` (or a near-perfect `average`).

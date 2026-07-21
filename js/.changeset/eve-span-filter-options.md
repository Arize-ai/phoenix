---
"@arizeai/phoenix-otel": minor
---

Add `spanFilter` and `reparentOrphanedSpans` options to `register()`. Pass `spanFilter: isOpenInferenceSpan` (from `@arizeai/openinference-vercel`) with `reparentOrphanedSpans: true` to keep only AI spans and re-root the ones left orphaned by the filter — useful with frameworks like Vercel Eve whose workflow-engine internals would otherwise clutter Phoenix traces.

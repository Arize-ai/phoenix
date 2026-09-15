---
"phoenix-ui": patch
---

Drop the removed `rootSpansOnly` and `orphanSpanAsRootSpan` GraphQL arguments from the traces table and trace detail queries, which now scope to root spans with the span filter DSL (`parent_span is None`) instead. The spans-filter agent operation description is corrected to match: a condition that is only a root predicate returns one span per trace.

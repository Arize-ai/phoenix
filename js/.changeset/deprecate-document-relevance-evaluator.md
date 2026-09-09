---
"@arizeai/phoenix-evals": patch
---

Deprecate `createDocumentRelevanceEvaluator` in favor of
`createRetrievalRelevanceEvaluator`. Rename `documentText` to `context` and the
`unrelated` label to `irrelevant`. The deprecated factory and its types will be
removed in the next major release.

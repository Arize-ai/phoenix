---
"@arizeai/phoenix-evals": patch
---

Deprecate `createDocumentRelevanceEvaluator` in favor of `createRetrievalRelevanceEvaluator`, which covers single-document evaluation as well as holistic, source-agnostic retrieval evaluation. To migrate, rename the `documentText` input field to `context` and update any code that checks for the `unrelated` label to check for `irrelevant` instead. `createDocumentRelevanceEvaluator` will be removed in a future major version.

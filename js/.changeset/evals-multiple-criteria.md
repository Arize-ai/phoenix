---
"@arizeai/phoenix-evals": minor
---

Support multiple criteria in classification evaluators. `choices` now accepts a list of criteria (each with its own name, instruction, `labels` mapped to optional descriptions, and an optional `scoreMap`) in addition to a single label-to-score map. A multi-criterion classifier answers every criterion in a single backend request — one `generateObject` call for language models, one `experimental_decide` call for decision models — and returns one result per criterion via the new `evaluateCriteria()` method. On the language-model path a criterion the model declines or answers with an off-list label fails on its own while its siblings are unaffected.

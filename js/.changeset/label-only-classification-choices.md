---
"@arizeai/phoenix-evals": minor
---

Classification evaluators now accept label-only `choices` in addition to a label-to-score map. Passing a list of labels (e.g. `["english", "spanish"]`) classifies into those labels and returns the predicted `label` with no `score`, which fits purely categorical evaluators where no label is meaningfully higher than another. Passing a label-to-score map (e.g. `{ correct: 1, incorrect: 0 }`) is unchanged and still returns a `score`.

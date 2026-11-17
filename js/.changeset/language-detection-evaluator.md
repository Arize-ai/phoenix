---
"@arizeai/phoenix-evals": minor
---

Add a built-in language detection evaluator (createLanguageDetectionEvaluator) that classifies the primary natural language of a conversation session into a fixed label set. `ClassificationEvaluator`'s `choices` may now be a plain list of labels (no score map), and a `ClassificationChoices` type is exported.

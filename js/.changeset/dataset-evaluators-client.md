---
"@arizeai/phoenix-client": minor
---

Add dataset evaluator bindings to the `evaluators` subpath: `createDatasetEvaluator`, `getDatasetEvaluators`, `getDatasetEvaluator`, `updateDatasetEvaluator`, `deleteDatasetEvaluator`, and `deleteDatasetEvaluators` (Phoenix server >= 21.0.0). Datasets are selected by `datasetId` or `datasetName`; a binding can reference an existing code or built-in evaluator or create a new LLM or code evaluator in one step. An output config override holds at least one config; omit it to inherit the evaluator's outputs. Deleting a binding keeps an LLM evaluator's prompt unless `deleteAssociatedPrompt` is set, and bulk deletion sends the ids in a request body. `EvaluatorDefinition` and `EvaluatorType` now include the read-only built-in variant.

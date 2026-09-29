---
"@arizeai/phoenix-client": minor
---

Add project evaluator bindings to the `evaluators` subpath: `createProjectEvaluator`, `getProjectEvaluators`, `getProjectEvaluator`, `updateProjectEvaluator`, `deleteProjectEvaluator`, and `deleteProjectEvaluators` (Phoenix server >= 21.0.0). A binding runs an evaluator on a project's incoming traces with a `SPAN`, `TRACE`, or `SESSION` target, a sampling rate, an optional span filter, and a quiet-period delay for traces and sessions. Projects are selected by name or GlobalID. Deleting a binding keeps an LLM evaluator's prompt unless `deleteAssociatedPrompt` is set, and bulk deletion sends the ids in a request body.

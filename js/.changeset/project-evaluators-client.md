---
"@arizeai/phoenix-client": minor
---

Add project evaluator bindings to the `evaluators` subpath: `createProjectEvaluator`, `getProjectEvaluators`, `getProjectEvaluator`, `updateProjectEvaluator`, `deleteProjectEvaluator`, and `deleteProjectEvaluators` (Phoenix server >= 21.0.0). `createProjectEvaluator` requires `evaluatorId` (an existing LLM or code evaluator) and runs it on a project's incoming traces with a `SPAN`, `TRACE`, or `SESSION` target, a sampling rate, an optional filter written in that target's language, and a quiet-period delay for traces and sessions. Projects are selected by name or GlobalID. Deleting a binding, singly or in bulk, always keeps the definition, its prompt, and the trace project -- there is no option to take them with it -- and `deleteProjectEvaluators` takes the project and sends the ids as repeated `project_evaluator_id` query parameters on the project's evaluator collection, atomically.

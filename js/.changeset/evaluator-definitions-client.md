---
"@arizeai/phoenix-client": minor
---

Add an `evaluators` subpath for shared evaluator definitions over REST (Phoenix server >= 21.0.0): `getEvaluators` lists definitions with `type`, `name`, and `limit`; `getEvaluator` reads one; `createEvaluator` creates a code evaluator that nothing binds yet and `deleteEvaluator` removes one once nothing binds it; `updateEvaluator` takes a patch discriminated by `type` and moves an LLM evaluator between prompt versions by `prompt_version_id`; `getCodeEvaluatorVersions` lists a code evaluator's history; and `createCodeEvaluatorVersion` appends immutable code, optionally with the configuration it needs and an `expectedCurrentVersionId` guard, reporting `was_created`. The definition, patch, create, version, input mapping, and output configuration types are exported from the same subpath.

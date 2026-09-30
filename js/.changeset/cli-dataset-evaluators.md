---
"@arizeai/phoenix-cli": minor
---

Add `px dataset evaluator list|get|create|update|delete` for managing the evaluators bound to a dataset (Phoenix server >= 21.0.0). `create` requires `--evaluator-id` (an existing LLM, code, or built-in evaluator definition; find one with `px evaluator list`) and `--input-mapping`; there is no inline `--evaluator` or `--evaluator-file`. `update` changes only the flags given and can drop a binding's overrides with `--inherit-description` and `--inherit-output-configs`. `delete` accepts several IDs at once behind `--dataset`, is gated behind `PHOENIX_CLI_DANGEROUSLY_ENABLE_DELETES` like the other delete verbs, always keeps the evaluator, its prompt, and the trace project -- there is no `--delete-prompt` -- and its `--format` controls how a refusal is rendered. `px evaluator list --type builtin` lists the read-only built-in definitions this layer's dataset bindings can now reference.

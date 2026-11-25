---
"@arizeai/phoenix-cli": minor
---

Add `px dataset evaluator list|get|create|update|delete` for managing the evaluators bound to a dataset (Phoenix server >= 21.0.0). `create` requires `--evaluator-id` (an existing LLM, code, or built-in evaluator definition; find one with `px evaluator list`) and `--input-mapping`; there is no inline `--evaluator` or `--evaluator-file`. `update` changes only the flags given and can drop a binding's overrides with `--inherit-description` and `--inherit-output-configs`. `delete` accepts several IDs at once behind `--dataset` and remains gated behind `PHOENIX_CLI_DANGEROUSLY_ENABLE_DELETES`. It removes each binding's dedicated evaluator trace project and its recorded evaluator traces while keeping the shared definition, prompt, and dataset; there is no `--delete-prompt`. Its `--format` controls how a refusal is rendered. `px evaluator list --type builtin` lists the read-only built-in definitions this layer's dataset bindings can now reference.

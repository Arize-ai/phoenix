---
"@arizeai/phoenix-cli": minor
---

Add `px dataset evaluator list|get|create|update|delete` for managing the evaluators bound to a dataset (Phoenix server >= 21.0.0). `create` binds an existing code or built-in evaluator with `--evaluator-id` or creates a new LLM or code evaluator from `--evaluator` JSON or `--evaluator-file`; a new code evaluator needs at least one `output_configs` entry. `update` changes only the flags given and can drop a binding's overrides with `--inherit-description` and `--inherit-output-configs`. `delete` accepts several IDs at once, keeps an LLM evaluator's prompt unless `--delete-prompt` is passed, and is gated behind `PHOENIX_CLI_DANGEROUSLY_ENABLE_DELETES` like the other delete verbs. `px evaluator list --type builtin` lists the read-only built-in definitions.

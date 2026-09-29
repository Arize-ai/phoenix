---
"@arizeai/phoenix-cli": minor
---

Add `px project evaluator list|get|create|update|delete` for managing the evaluators that run on a project's incoming traces (Phoenix server >= 21.0.0). `create` takes the evaluation target and sampling rate plus optional filter, `--disabled`, input mapping, and evaluation delay, and binds an existing code evaluator with `--evaluator-id` or creates a new LLM or code evaluator from `--evaluator` JSON or `--evaluator-file`; a new code evaluator needs at least one `output_configs` entry. `update` pauses or retunes a binding with only the flags you pass and can fall back to the definition's input mapping or the server's default delay with `--inherit-input-mapping` and `--default-evaluation-delay`. `delete` accepts several IDs, keeps an LLM evaluator's prompt unless `--delete-prompt` is passed, and is gated behind `PHOENIX_CLI_DANGEROUSLY_ENABLE_DELETES`.

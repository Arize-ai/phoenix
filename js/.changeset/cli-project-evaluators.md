---
"@arizeai/phoenix-cli": minor
---

Add `px project evaluator list|get|create|update|delete` for managing the evaluators that run on a project's incoming traces (Phoenix server >= 21.0.0). `create` requires `--evaluator-id` (an existing LLM or code evaluator; find one with `px evaluator list`) plus the evaluation target and sampling rate, with optional filter, `--disabled`, input mapping, and evaluation delay -- there is no inline evaluator. `update` pauses or retunes a binding with only the flags you pass and can fall back to the definition's input mapping or the server's default delay with `--inherit-input-mapping` and `--default-evaluation-delay`. `delete` accepts several IDs behind `--project`, is gated behind `PHOENIX_CLI_DANGEROUSLY_ENABLE_DELETES`, always keeps the evaluator, its prompt, and the trace project -- there is no `--delete-prompt` -- and its `--format` controls how a refusal is rendered.

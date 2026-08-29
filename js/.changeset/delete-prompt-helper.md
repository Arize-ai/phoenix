---
"@arizeai/phoenix-client": minor
---

Add a `deletePrompt` helper to the `prompts` subpath. It takes a `prompt` selector — `{ name }` or `{ promptId }` — matching the selector style `getPrompt` already uses, and calls `DELETE /v1/prompts/{prompt_identifier}` (Phoenix server >= 13.20.0). Version-level selectors (`{ versionId }`, `{ name, tag }`) are rejected rather than widened to the whole prompt. Deletion cascades to every version of the prompt along with its version tags and labels.

Also exports a `PromptIdentifier` type from `types/prompts` for the prompt-level selector union.

---
"@arizeai/phoenix-client": minor
---

Add a `deletePrompt` helper to the `prompts` subpath. It accepts a prompt name or Global ID and calls `DELETE /v1/prompts/{prompt_identifier}` (Phoenix server >= 13.20.0). Deletion cascades to every version of the prompt along with its version tags and labels.

---
"@arizeai/phoenix-cli": minor
---

Add `--attribute` filter to `px span list` for filtering by attribute key/value pairs (e.g., `--attribute "llm.model_name:gpt-4"`). Split is on the first `:` only, so values may contain colons. Repeat the flag to AND multiple filters. JSON-quote a value to force string matching when it looks like a number or boolean (e.g., `'user.id:"12345"'`). Requires Phoenix server >= 14.9.0.

---
type: llm
focus: {source: file, path: schema_eval.py}
weight: 0.5
---
The user wants an evaluator for output that must be a JSON object with exactly three fields — `name` (string), `age` (integer), `email` (string) — and nothing extra.

Grade exactly one claim. PASS if the claim below holds, FAIL otherwise. Ignore everything else about the file.

Claim: The evaluator treats the schema as closed — output containing any field beyond `name`, `age`, and `email` is judged invalid (e.g. it checks the set of keys equals exactly those three, or uses a schema with `additionalProperties: false`). An evaluator that only checks the three required fields are present and ignores extra keys FAILS.

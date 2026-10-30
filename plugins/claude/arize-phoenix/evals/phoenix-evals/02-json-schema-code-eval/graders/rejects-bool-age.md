---
type: llm
focus: {source: file, path: schema_eval.py}
weight: 0.5
---
The user wants an evaluator for output that must be a JSON object with exactly three fields — `name` (string), `age` (integer), `email` (string) — and nothing extra.

Grade exactly one claim. PASS if the claim below holds, FAIL otherwise. Ignore everything else about the file.

Claim: The evaluator rejects a boolean `age` (e.g. `{"age": true}`). In Python `isinstance(True, int)` is `True`, so a plain `isinstance(value, int)` check accepts booleans; the evaluator must exclude `bool` explicitly (e.g. `isinstance(v, int) and not isinstance(v, bool)`, `type(v) is int`, or a JSON Schema validator whose `integer` type rejects booleans). An `isinstance(age, int)` check with no bool exclusion FAILS.

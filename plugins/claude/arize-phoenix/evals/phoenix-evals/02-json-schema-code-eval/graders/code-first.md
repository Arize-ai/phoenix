---
type: llm
focus: {source: file, path: schema_eval.py}
weight: 0.5
---
The user asked for an evaluator that checks whether an output string is valid JSON matching a fixed schema (`name` string, `age` integer, `email` string). This is a deterministic check.

Grade exactly one claim. PASS if the claim below holds, FAIL otherwise. Ignore everything else about the file.

Claim: The evaluator verifies the output with deterministic Python code (parsing the JSON and checking the fields/types, e.g. via `json.loads` and explicit checks or `jsonschema`). It does NOT call a language model to judge validity.

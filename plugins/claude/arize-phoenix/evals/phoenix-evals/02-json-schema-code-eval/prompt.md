---
max_turns: 8
timeout_seconds: 300
allowed_tools: [Skill, Write]
runs: 3
tags: [phoenix-evals]
---
My agent is supposed to emit a single JSON object with exactly these fields: `name` (string), `age` (integer), and `email` (string). I want an evaluator that checks whether a given output string is valid JSON and conforms to that schema. Write it to `schema_eval.py` in the current directory. Do not run it.

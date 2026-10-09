---
max_turns: 8
timeout_seconds: 300
allowed_tools: [Skill, Write]
runs: 3
tags: [phoenix-evals]
---
My agent is supposed to emit a single JSON object with exactly these fields: `name` (string), `age` (integer), and `email` (string). I want a Phoenix evaluator that checks whether a given output string is valid JSON and conforms to that schema — exactly those three fields, nothing extra. Put it in `schema_eval.py`.

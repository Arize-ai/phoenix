---
type: regex
target: {source: file, path: schema_eval.py}
match: contains
---
@create_evaluator|kind\s*=\s*["']code["']

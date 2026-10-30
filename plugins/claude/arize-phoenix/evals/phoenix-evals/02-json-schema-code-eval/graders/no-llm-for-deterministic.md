---
type: regex
target: {source: file, path: schema_eval.py}
match: not_contains
---
ClassificationEvaluator|create_classifier|\bLLM\(

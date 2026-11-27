---
type: regex
target: {source: file, path: hallucination_check.py}
match: contains
---
from phoenix\.evals\.metrics import|ClassificationEvaluator

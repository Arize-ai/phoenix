---
type: regex
target: {source: file, path: run_eval_experiment.py}
match: contains
---
from phoenix\.client(\.experiments)? import|from phoenix\.client import

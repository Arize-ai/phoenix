---
type: llm
focus: {source: file, path: run_eval_experiment.py}
weight: 0.5
---
The user asked how to run their task plus an evaluator over a 50-example QA dataset as a Phoenix experiment.

Grade exactly one claim. PASS if the claim below holds, FAIL otherwise. Ignore everything else about the file.

Claim: The script obtains a dataset, defines a task function, and calls `run_experiment` passing the dataset, the task, and one or more evaluators. It is concrete enough that the user could run it, not pseudocode or a bare description.

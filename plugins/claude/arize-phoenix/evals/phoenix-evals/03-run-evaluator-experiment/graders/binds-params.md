---
type: llm
focus: {source: file, path: run_eval_experiment.py}
weight: 0.5
---
The script runs a task plus an evaluator over a 50-example QA dataset whose examples each have a `question` (input) and an `expected` answer (output).

Grade exactly one claim. PASS if the claim below holds, FAIL otherwise. Ignore everything else about the file.

Claim: The task reads the question from the example input (e.g. `example.input["question"]`), and the evaluator receives the task output and the expected answer through the standard experiment parameter names (`output` and `expected`), consistent with how the dataset's input/output keys were built — so it would run rather than raise a missing-key or missing-parameter error.

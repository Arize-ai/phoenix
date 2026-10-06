---
type: llm
focus: {source: file, path: validate_judge.py}
weight: 0.5
---
The user has 80 human pass/fail labels and their LLM judge's predictions over the same 80 examples, and wants to decide whether the judge is trustworthy.

Grade exactly one claim. PASS if the claim below holds for the file, FAIL otherwise. Ignore everything else about the file.

Claim: The script measures agreement between the judge's predictions and the human labels using a classification or agreement metric (accuracy, precision/recall, TPR/TNR, a confusion matrix, or Cohen's kappa) and uses a principled pass criterion to decide whether to trust the judge — a numeric bar (e.g. ~80%), a kappa threshold, or comparison against the human–human agreement ceiling. It does not just re-run or tweak the judge without comparing it to the human labels.

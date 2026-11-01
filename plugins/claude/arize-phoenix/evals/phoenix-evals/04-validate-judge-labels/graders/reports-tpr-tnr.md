---
type: llm
focus: {source: file, path: validate_judge.py}
weight: 0.5
---
The user has 80 human pass/fail labels and their LLM judge's predictions over the same 80 examples, and wants to decide whether the judge is trustworthy.

Grade exactly one claim. PASS if the claim below holds for the file, FAIL otherwise. Ignore everything else about the file.

Claim: The script reports TPR and TNR (sensitivity/specificity) separately, not only an overall accuracy number, and judges the judge against a principled bar (accuracy above ~80% and both TPR and TNR above ~70%). Collapsing the decision to a single accuracy figure FAILS.

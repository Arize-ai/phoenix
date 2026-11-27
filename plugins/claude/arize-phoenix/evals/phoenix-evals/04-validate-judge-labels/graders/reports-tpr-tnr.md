---
type: llm
focus: {source: file, path: validate_judge.py}
weight: 0.5
---
The user has 80 human pass/fail labels and their LLM judge's predictions over the same 80 examples, and wants to decide whether the judge is trustworthy.

Grade exactly one claim. PASS if the claim below holds for the file, FAIL otherwise. Ignore everything else about the file.

Claim: The script reports the judge's error rates on each class separately, not only an overall accuracy number: TPR and TNR (sensitivity/specificity), or the equivalent recall and false-positive rate, or recall and precision. It judges the judge against a stated numeric bar for those rates (for example, both TPR and TNR above ~70%, or recall and precision of at least 80%). Collapsing the decision to a single accuracy figure FAILS.

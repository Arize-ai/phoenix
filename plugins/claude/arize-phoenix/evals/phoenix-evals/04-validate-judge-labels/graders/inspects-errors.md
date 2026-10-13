---
type: llm
focus: {source: file, path: validate_judge.py}
weight: 0.5
---
The user has 80 examples that two analysts labeled by hand, plus their LLM judge's predictions over the same 80, and wants to decide whether the judge is trustworthy.

Grade exactly one claim. PASS if the claim below holds for the file, FAIL otherwise. Ignore everything else about the file.

Claim: The script isolates and surfaces the judge's disagreements with the human labels — its false positives (judge passes, human fails) and false negatives (judge fails, human passes) — for inspection, rather than reporting only aggregate scores. Any means of pulling out and examining the disagreeing examples counts, regardless of variable names; computing only an overall accuracy or TPR/TNR number without separating the disagreements FAILS.

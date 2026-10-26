---
type: llm
focus: {source: file, path: validate_judge.py}
weight: 0.5
---
The user has 80 examples that two analysts labeled by hand as pass/fail, plus their LLM judge's predictions over the same 80, and wants to decide whether the judge is trustworthy.

Grade exactly one claim. PASS if the claim below holds, FAIL otherwise. Ignore everything else about the file.

Claim: The script checks or reports the pass/fail balance of the human labels — e.g. that a skewed set such as 70 pass / 10 fail makes accuracy look good while TNR is poor, or that the set should be roughly balanced. Mentioning TPR/TNR alone, without tying it to class balance, FAILS.

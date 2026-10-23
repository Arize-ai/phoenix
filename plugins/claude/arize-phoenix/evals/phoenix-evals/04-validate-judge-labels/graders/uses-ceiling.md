---
type: llm
focus: {source: file, path: validate_judge.py}
weight: 0.5
---
The user has 80 examples that two analysts labeled by hand, plus their LLM judge's predictions over the same 80, and wants to decide whether the judge is trustworthy.

Grade exactly one claim. PASS if the claim below holds for the file, FAIL otherwise. Ignore everything else about the file.

Claim: The script treats the agreement between the two human analysts as the ceiling the judge is measured against — e.g. it computes how often the two analysts agree, or addresses what to do when they disagree — rather than assuming the human labels are a single perfect ground truth.

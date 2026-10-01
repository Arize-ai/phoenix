---
type: llm
focus: last_message
weight: 0.5
---
The user has 80 human pass/fail labels and their LLM judge's predictions over the same 80 examples, and wants to decide whether the judge is trustworthy.

Grade exactly one claim. PASS if the claim below holds for the response, FAIL otherwise. Ignore everything else about the response.

Claim: The response measures agreement between the judge's predictions and the human labels using a classification metric (accuracy, precision/recall, TPR/TNR, or a confusion matrix) and ties the decision to a concrete bar (for example TPR and TNR above ~80%). It does not just re-run or tweak the judge without comparing it to the human labels.

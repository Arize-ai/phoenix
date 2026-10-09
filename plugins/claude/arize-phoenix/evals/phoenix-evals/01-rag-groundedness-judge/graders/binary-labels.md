---
type: llm
focus: {source: file, path: groundedness_eval.py}
weight: 0.5
---
The file is a Phoenix evaluator that should judge whether a RAG answer is grounded in its retrieved context.

Grade exactly one claim. PASS if the claim below holds, FAIL otherwise. Ignore everything else about the file.

Claim: The evaluator produces a discrete label rather than a numeric/Likert rating. This holds if either (a) it defines its own discrete labels (such as grounded/ungrounded or factual/hallucinated) mapped to scores through a `choices` mapping, or (b) it uses a Phoenix pre-built label-based evaluator such as `FaithfulnessEvaluator`. It FAILS only if the evaluator asks the model for a 1-to-5, 1-to-10, or other numeric/Likert rating.

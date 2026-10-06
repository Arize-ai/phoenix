---
type: llm
focus: {source: file, path: groundedness_eval.py}
weight: 0.5
---
The file is a Phoenix evaluator that should judge whether a RAG answer is grounded in its retrieved context.

Grade exactly one claim. PASS if the claim below holds, FAIL otherwise. Ignore everything else about the file.

Claim: The evaluator decides between discrete labels (such as grounded/ungrounded or factual/hallucinated) mapped to scores through a `choices` mapping. It does not ask the model for a 1-to-5, 1-to-10, or other numeric/Likert rating.

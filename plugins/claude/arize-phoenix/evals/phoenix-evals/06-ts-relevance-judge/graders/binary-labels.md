---
type: llm
focus: {source: file, path: relevanceEvaluator.ts}
weight: 0.5
---
The file is a Phoenix TypeScript evaluator that should judge whether an assistant answer is relevant to the user's question.

Grade exactly one claim. PASS if the claim below holds, FAIL otherwise. Ignore everything else about the file.

Claim: The evaluator decides between discrete choices (such as relevant/irrelevant) mapped to scores through a `choices` object. It does not ask the model for a 1-to-5, 1-to-10, or other numeric/Likert rating.

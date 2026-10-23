---
type: llm
focus: last_message
weight: 0.5
---
The user asked for an evaluator that judges whether a RAG answer is grounded in the retrieved context.

Grade exactly one claim. PASS if the claim below holds for the response, FAIL otherwise. Ignore everything else about the response.

Claim: The response tells the user to validate the judge against human-labeled examples (measuring agreement, accuracy, or TPR/TNR) before trusting it, rather than presenting the evaluator as ready to trust unchecked. A single sentence recommending validation is enough.

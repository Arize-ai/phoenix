---
"@arizeai/phoenix-evals": minor
---

Redesign `createHallucinationEvaluator` as a conversation-grounding evaluator.

This changes the evaluator input to `input` and `output`, where `input` is the conversation available to the assistant and `output` is the response being judged. A separate `context` field is no longer accepted.

Labels change from `factual`/`hallucinated` to `grounded`/`hallucinated`. Scores are minimized, with `hallucinated` equal to `1` and `grounded` equal to `0`. Existing stored evaluations, dashboards, thresholds, and label filters may require migration and should not be compared directly with results from the previous evaluator.

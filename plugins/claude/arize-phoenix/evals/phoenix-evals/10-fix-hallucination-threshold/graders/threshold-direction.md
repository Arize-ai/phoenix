---
type: llm
focus: {source: file, path: hallucination_check.py}
weight: 0.5
---
The user pasted a check that runs `HallucinationEvaluator` (imported from top-level `phoenix.evals`) over a RAG dataframe with `input`, `output`, and `context` columns, then calls `.mean()` on the `hallucination_score` column and fails when the mean is below 0.8. They want the batch to fail when more than 20% of answers are not supported by the retrieved documents. Facts: pre-built evaluators live in `phoenix.evals.metrics`; `evaluate_dataframe` returns `{name}_score` columns holding dicts like `{"score": ..., "label": ..., "explanation": ...}`; `HallucinationEvaluator` takes only `input`/`output` (no `context`), labels `hallucinated`=1.0 / `grounded`=0.0 and is minimized; `FaithfulnessEvaluator` takes `input`/`output`/`context`, labels `faithful`=1.0 / `unfaithful`=0.0 and is maximized.

Grade exactly one claim. PASS if the claim below holds, FAIL otherwise. Ignore everything else about the file.

Claim: The pass/fail logic matches the evaluator's score direction so the batch fails exactly when more than 20% of answers are unsupported: with `HallucinationEvaluator` (hallucinated = 1.0) it fails when the hallucinated rate exceeds 0.2; with `FaithfulnessEvaluator` (faithful = 1.0) it fails when the faithful rate is below 0.8. Treating 1.0 as "good" for a hallucination score FAILS.

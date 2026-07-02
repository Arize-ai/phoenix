---
"@arizeai/phoenix-evals": minor
---

Add built-in code (non-LLM) evaluators for classification metrics: `createPrecisionEvaluator`, `createRecallEvaluator`, `createF1Evaluator`, `createFBetaEvaluator`, and the bundling helper `createPrecisionRecallFScoreEvaluators`, plus the underlying `computePrecisionRecallFScore` function. These support binary (via `positiveLabel`) and multi-class (`macro`/`micro`/`weighted` averaging) classification, mirroring the Python `PrecisionRecallFScore` evaluator.

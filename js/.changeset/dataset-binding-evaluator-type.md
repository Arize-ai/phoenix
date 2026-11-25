---
"@arizeai/phoenix-client": minor
"@arizeai/phoenix-cli": minor
---

Dataset evaluator bindings name the kind of evaluator they run. `createDatasetEvaluator` takes a required `evaluatorType` (`"llm"`, `"code"`, `"builtin"`, or `"decision"`), and an `updateDatasetEvaluator` patch carries a required `evaluator_type`; the server refuses a kind that does not match the evaluator. A decision binding takes no `outputConfigs` or `output_configs`, since its outputs follow the evaluator's questions and scoring policy, and an LLM binding's output overrides are typed as categorical. `px dataset evaluator create` and `update` read the evaluator or binding first to learn its kind, and refuse `--output-configs` and `--inherit-output-configs` on a decision binding.

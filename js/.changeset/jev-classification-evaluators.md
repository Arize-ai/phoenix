---
"@arizeai/phoenix-evals": minor
---

Classification evaluators now accept AI SDK evaluation models such as TypeSafe's Jev. When an evaluation model is passed as `model`, the classification is routed through `experimental_evaluate` as a single choice question instead of `generateObject`. Results carry a `label` and `score` but no `explanation`, since evaluation models do not generate text.

---
"@arizeai/phoenix-evals": minor
---

Classification evaluators, including every built-in, can now run on AI SDK decision models such as `openai.decisionModel("gpt-6-luna")`. The label comes from `experimental_decide`, with label probabilities (and the provider's confidence, when reported) in `metadata`. Templates with one `<data>` block, including every built-in, are split into a rubric sent as the question's instructions and the rendered block sent as the state being judged. Refusals throw a `ClassificationRefusalError`. Decide spans now record the decision state, question and answer. New exports: `ClassificationRefusalError`, `isDecisionModel` and the `DecisionModel` type.

This replaces the evaluation model support from the previous release, and changes what evaluation models such as TypeSafe's Jev are sent. They now go through `experimental_decide` too. Message prompts are joined into plain text instead of being serialized as JSON state, and templates are split at their `<data>` block as above.

`ai` is pinned to `7.0.133` and `@ai-sdk/otel` to `1.0.133`, because the decision API is experimental and has changed in patch releases, and `@ai-sdk/otel` depends on one exact `ai` version. Use `@ai-sdk/openai` 4.0.89 or later with OpenAI decision models. Earlier versions receive the state as JSON-encoded text instead of plain text.

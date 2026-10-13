---
"@arizeai/phoenix-evals": minor
---

Classification evaluators, including every built-in, can now run on AI SDK decision models such as `openai.decisionModel("gpt-6-luna")`. The label comes from `experimental_decide`, with label probabilities (and the provider's confidence, when reported) in `metadata`. The rendered prompt is sent as plain text, and refusals throw the AI SDK's `Experimental_DecisionRefusalError`. Decide spans now record the decision state, question and answer. New exports: `isDecisionModel` and the `DecisionModel` type.

This replaces the evaluation model support from the previous release, and changes what evaluation models such as TypeSafe's Jev are sent. They now go through `experimental_decide` too. Message prompts are joined into plain text instead of being serialized as JSON state.

`ai` is pinned to `7.0.137` and `@ai-sdk/otel` to `1.0.137`, because the decision API is experimental and has changed in patch releases, and `@ai-sdk/otel` depends on one exact `ai` version. Use `@ai-sdk/openai` 4.0.89 or later with OpenAI decision models. Earlier versions receive the state as JSON-encoded text instead of plain text.

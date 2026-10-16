# Evaluators: LLM Evaluators in TypeScript

LLM evaluators use a language model to judge outputs. Uses Vercel AI SDK.

## Quick Start

```typescript
import { createClassificationEvaluator } from "@arizeai/phoenix-evals";
import { openai } from "@ai-sdk/openai";

const helpfulness = await createClassificationEvaluator<{
  input: string;
  output: string;
}>({
  name: "helpfulness",
  model: openai("gpt-4o"),
  promptTemplate: `Rate helpfulness.
<question>{{input}}</question>
<response>{{output}}</response>
Answer (helpful/not_helpful):`,
  choices: { not_helpful: 0, helpful: 1 },
});
```

## Decision Models

`model` also accepts an AI SDK decision model, such as OpenAI's `gpt-6-luna` (Decisions API) or TypeSafe's Jev. A decision model picks one of the labels directly and returns a probability for each instead of generating text, so it is much faster and cheaper than a chat model judge. Every classification evaluator, built-in or custom, works with one. Requires `@arizeai/phoenix-evals` >= 2.7.0; with OpenAI, use `@ai-sdk/openai` >= 4.0.89.

```typescript
import { openai } from "@ai-sdk/openai";
import { createCorrectnessEvaluator } from "@arizeai/phoenix-evals";

const correctness = createCorrectnessEvaluator({
  model: openai.decisionModel("gpt-6-luna"),
});

const result = await correctness.evaluate({
  input: "What is the capital of Australia?",
  output: "Sydney.",
});
// { label: "incorrect", score: 0,
//   metadata: { probabilities: { correct: 0.02, incorrect: 0.98 }, confidence: 0.96, modelId: "gpt-6-luna" } }
```

For Jev, pass `typeSafeAi.evaluationModel("jev-latest")` from `@ai-sdk/typesafe-ai`.

- **No explanation:** `explanation` is always undefined. `metadata.probabilities` maps each label to its probability; `metadata.confidence` is present when the provider reports one (OpenAI and TypeSafe do).
- **Prompt shape:** the template renders as it would for a language model, then goes out as one plain-text state. Message roles are dropped and only text content is sent.
- **Refusals:** a refusal throws the AI SDK's `Experimental_DecisionRefusalError`; inside `runExperiment` it is recorded as that evaluation's error.
- **String IDs:** a plain string model ID is always treated as a language model. Use the provider's `decisionModel()`.
- **Type guard:** `isDecisionModel(model)` and the `DecisionModel` type are exported from `@arizeai/phoenix-evals`.
- **Tracing:** calls go through the AI SDK's `experimental_decide`, which `@arizeai/phoenix-otel` records as DECISION spans (see the phoenix-tracing skill's `span-decision.md`).
- **When not to use:** decision models can't work through a problem step by step. They suit judgments you can read off the text (relevance, faithfulness, tool selection, toxicity) and are unreliable for checks that need a calculation, such as arithmetic or unit conversions. Use a language model for those.

## Template Variables

Use XML tags: `<question>{{input}}</question>`, `<response>{{output}}</response>`, `<context>{{context}}</context>`

## Custom Evaluator with asExperimentEvaluator

```typescript
import { asExperimentEvaluator } from "@arizeai/phoenix-client/experiments";

const customEval = asExperimentEvaluator({
  name: "custom",
  kind: "LLM",
  evaluate: async ({ input, output }) => {
    // Your LLM call here
    return { score: 1.0, label: "pass", explanation: "..." };
  },
});
```

## Pre-Built Evaluators

```typescript
import { createFaithfulnessEvaluator } from "@arizeai/phoenix-evals";

const faithfulnessEvaluator = createFaithfulnessEvaluator({
  model: openai("gpt-4o"),
});
```

## Best Practices

- Be specific about criteria
- Include examples in prompts
- Use `<thinking>` for chain of thought

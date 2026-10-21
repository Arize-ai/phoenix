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

Any classification evaluator, including every built-in, also accepts an AI SDK decision model such as OpenAI's `gpt-6-luna` or TypeSafe's Jev. A decision model picks one of the labels directly instead of generating text, so it is a cheaper, faster judge for high-volume labeling. With OpenAI, use `@ai-sdk/openai` 4.0.89 or later.

```typescript
import { openai } from "@ai-sdk/openai";
import { createCorrectnessEvaluator } from "@arizeai/phoenix-evals";

const correctness = createCorrectnessEvaluator({
  model: openai.decisionModel("gpt-6-luna"),
});
// { label: "incorrect", score: 0,
//   metadata: { probabilities: { correct: 0.02, incorrect: 0.98 }, confidence: 0.96, modelId: "gpt-6-luna" } }
```

- **No explanation.** `explanation` is always undefined; `metadata.probabilities` maps each label to its probability, and `metadata.confidence` is set when the provider reports one.
- **Plain-text prompt.** The template is rendered as usual, then sent as one plain-text state; message roles are dropped.
- **Refusals throw.** A refusal throws the AI SDK's `Experimental_DecisionRefusalError`; in `runExperiment` it is recorded as that evaluation's error.
- **String IDs are language models.** Wrap the ID with the provider's `decisionModel()`. `isDecisionModel(model)` and the `DecisionModel` type are exported for branching on this yourself.
- **Not for calculations.** Decision models can't reason step by step; use a language model for judgments that need arithmetic or unit conversion.

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

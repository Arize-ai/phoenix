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

## Decision-Only Models

`model` also accepts an AI SDK evaluation model (e.g. TypeSafe's Jev), a cheaper, faster classifier for high-volume labeling:

```typescript
import { createHallucinationEvaluator } from "@arizeai/phoenix-evals";
import { typeSafeAi } from "@ai-sdk/typesafe-ai";

const hallucination = createHallucinationEvaluator({
  model: typeSafeAi.evaluationModel("jev-latest"),
});
```

Results have no `explanation`; `metadata` holds per-label `probabilities` and `modelId`. No spans are emitted.

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

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

## Template Variables

Use XML tags: `<question>{{input}}</question>`, `<response>{{output}}</response>`, `<context>{{context}}</context>`

## Custom Evaluator with asEvaluator

```typescript
import { asEvaluator } from "@arizeai/phoenix-client/experiments";

const customEval = asEvaluator({
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

See full list: [@arizeai/phoenix-evals](https://arize-ai.github.io/phoenix/modules/_arizeai_phoenix-evals.html)

## Best Practices

- Be specific about criteria
- Include examples in prompts
- Use `<thinking>` for chain of thought

**Library Reference:** [@arizeai/phoenix-evals TypeScript](https://arize-ai.github.io/phoenix/modules/_arizeai_phoenix-evals.html)

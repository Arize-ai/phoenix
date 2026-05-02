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

## PairwiseEvaluator

Use `PairwiseEvaluator` to compare exactly two outputs. Prompt templates must use
`{{item_1}}` and `{{item_2}}` for the randomized positions, and must not reference
the group names directly.

```typescript
import { PairwiseEvaluator } from "@arizeai/phoenix-evals";
import { openai } from "@ai-sdk/openai";

const pairwise = new PairwiseEvaluator({
  name: "helpfulness_pairwise",
  model: openai("gpt-4o"),
  promptTemplate: `Compare responses for helpfulness.
<question>{{input}}</question>
<response-a>{{item_1}}</response-a>
<response-b>{{item_2}}</response-b>
Choose A, B, or tie.`,
  groups: ["candidate", "baseline"],
  ordering: "random", // "random" | "both" | "fixed"
});

const score = await pairwise.evaluate({
  input: "How do I reset my password?",
  candidate: "Go to settings, then account, then reset password.",
  baseline: "Use settings.",
});
```

`ordering="both"` runs the judge twice with swapped positions and returns a tie
when the two passes disagree. Result `metadata` records `presented_first`,
per-pass judge choices, rationales, and tie reason.

## Best Practices

- Be specific about criteria
- Include examples in prompts
- Use `<thinking>` for chain of thought

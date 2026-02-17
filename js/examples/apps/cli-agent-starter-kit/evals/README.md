# Agent Evaluation Harness

Automated evaluation framework for the Phoenix Documentation Assistant CLI agent.

## Quick Start

```bash
# Run all evaluations
pnpm eval

# Run evaluations matching a pattern
pnpm eval terminal

# Run specific evaluation directly
pnpm eval:terminal-format
```

## Available Evaluations

- **Terminal Safe Format**: Calls the real agent and verifies outputs don't contain markdown syntax (bold, italic, code blocks, links, etc.)

## Project Structure

```
evals/
├── evaluators/          # Evaluator definitions (camelCase)
├── datasets/            # Test datasets (camelCase)
├── experiments/         # Experiment runners (kebab-case.eval.ts)
└── utils/              # Shared utilities (camelCase)
```

## Creating New Evaluators

1. **Create evaluator** in `evals/evaluators/myEvaluator.ts`:
```typescript
import { createEvaluator } from "@arizeai/phoenix-evals";

export const myEvaluator = createEvaluator(
  ({ output }: { output: string }) => {
    const score = /* compute score */;
    const label = /* determine label */;
    return { score, label, explanation: "..." };
  },
  { name: "my-evaluator", kind: "CODE", optimizationDirection: "MAXIMIZE" }
);
```

2. **Create dataset** in `evals/datasets/myExamples.ts`:
```typescript
export const myExamples = [
  {
    input: { prompt: "test" },
    output: { response: "expected" },
    metadata: { category: "test" },
  },
];
```

3. **Create experiment** in `evals/experiments/my-eval.eval.ts`:
```typescript
#!/usr/bin/env tsx
import { createClient } from "@arizeai/phoenix-client";
import { createOrGetDataset } from "@arizeai/phoenix-client/datasets";
import { runExperiment } from "@arizeai/phoenix-client/experiments";

async function main() {
  const client = createClient();

  const { datasetId } = await createOrGetDataset({
    client,
    name: "my-dataset",
    description: "My dataset description",
    examples: myExamples,
  });

  await runExperiment({
    client,
    experimentName: "my-eval",
    dataset: { datasetId },
    task: async (example) => example.output.response,
    evaluators: [myEvaluator],
    logger: console,
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

4. **Run it**: `pnpm eval my-eval` or `tsx evals/experiments/my-eval.eval.ts`

## View Results

http://localhost:6006/datasets

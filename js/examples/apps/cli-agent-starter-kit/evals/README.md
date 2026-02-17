# Agent Evaluation Harness

Automated evaluation framework for the Phoenix Documentation Assistant CLI agent.

## Quick Start

```bash
# Interactive mode (select experiment)
pnpm eval

# Run specific evaluation
pnpm eval:terminal-format

# Without Phoenix UI check
pnpm eval:no-phoenix
```

## Available Evaluations

### Terminal Safe Format

Verifies agent outputs don't contain markdown syntax (bold, italic, code blocks, links, etc.).

- **Type**: Code-based (regex pattern matching)
- **Dataset**: 16 curated examples
- **Metric**: Binary (pass/fail)
- **Location**: `evals/evaluators/terminal-safe-format.ts`

## Project Structure

```
evals/
├── evaluators/          # Evaluator definitions
│   ├── terminal-safe-format.ts
│   └── index.ts
├── datasets/            # Test datasets
│   ├── terminal-format-examples.ts
│   └── index.ts
├── experiments/         # Experiment runners (*.eval.ts pattern)
│   ├── terminal-format.eval.ts
│   └── index.ts
├── utils/              # Shared utilities
│   ├── markdown-patterns.ts
│   └── index.ts
└── README.md           # This file
```

## Creating New Evaluators

### 1. Create Evaluator

```typescript
// evals/evaluators/my-evaluator.ts
import { createEvaluator } from "@arizeai/phoenix-evals";

export const myEvaluator = createEvaluator(
  ({ output }: { output: string }) => {
    const score = /* compute score */;
    const label = /* determine label */;
    const explanation = /* provide explanation */;

    return { score, label, explanation };
  },
  {
    name: "my-evaluator",
    kind: "CODE", // or "LLM"
    optimizationDirection: "MAXIMIZE",
  }
);
```

### 2. Create Dataset

```typescript
// evals/datasets/my-examples.ts
import type { Example } from "@arizeai/phoenix-client/types/datasets";

export const myExamples: Example[] = [
  {
    input: { prompt: "test prompt" },
    output: { response: "expected response" },
    metadata: { category: "test" },
  },
  // ... more examples
];
```

### 3. Create Experiment

```typescript
// evals/experiments/my-eval.eval.ts
import { createClient } from "@arizeai/phoenix-client";
import { createDataset } from "@arizeai/phoenix-client/datasets";
import { runExperiment } from "@arizeai/phoenix-client/experiments";

// Metadata for CLI auto-discovery
export const metadata = {
  name: "My Evaluator",
  description: "Description of what this evaluates",
  hint: "Additional context or usage hint",
};

export async function runMyEval() {
  const client = createClient();

  const { id: datasetId } = await createDataset({
    client,
    name: "my-dataset",
    examples: myExamples,
  });

  const experiment = await runExperiment({
    client,
    experimentName: "my-eval",
    dataset: { datasetId },
    task: async (example) => {
      // Return output to evaluate
      return example.output.response;
    },
    evaluators: [myEvaluator],
    logger: console,
  });

  return experiment;
}
```

### 4. Auto-Discovery

No need to update `scripts/run-evals.ts`! The CLI automatically discovers and lists all `.eval.ts` files.

Just ensure your eval file:
- Has a `.eval.ts` extension
- Exports a `metadata` object with `name`, `description`, and optional `hint`
- Exports an evaluation function that accepts `{ client, logger }`

## Viewing Results

Results are stored in Phoenix and visible at http://localhost:6006

1. Navigate to **Datasets** section
2. Find your dataset (e.g., "cli-agent-terminal-format")
3. Click **Compare** to view experiment results
4. See pass/fail status, scores, and explanations

## Testing Tips

- **Use mock responses**: Return dataset outputs for deterministic testing
- **Categorize examples**: Use metadata to organize test cases
- **Document edge cases**: Add descriptions explaining what each example tests
- **Start small**: Begin with 10-15 examples, expand as needed
- **Validate evaluators**: Manually review results to ensure accuracy

## Troubleshooting

### Phoenix not running

```bash
# Start Phoenix (docker-based)
pnpm phoenix:ensure

# Or run without Phoenix check
pnpm eval:no-phoenix
```

### API connection errors

Verify Phoenix is accessible:
```bash
curl http://localhost:6006/api/health
```

### Evaluation failures

Run with verbose logging:
```bash
VERBOSE=true pnpm eval
```

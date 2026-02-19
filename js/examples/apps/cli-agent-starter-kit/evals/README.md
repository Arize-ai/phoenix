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

---

## Benchmarking Strategy: Evaluating the Evaluators

LLM-based evaluators are themselves models that can make mistakes. Before you rely on an evaluator
to judge your agent's outputs, you should measure how accurate the evaluator is. This is called
**evaluator benchmarking** (or "meta-evaluation").

### The Core Idea

Create a **golden dataset** — a small set of hand-labeled examples where you know the correct
answer — and run your evaluator against it. Measure how often the evaluator agrees with the ground
truth. A well-calibrated evaluator should reach **>80% TPR and >80% TNR** before you trust it at
scale.

```
Golden dataset (hand-labeled)
        │
        ▼
  Benchmark experiment
  (task = run the evaluator, evaluator = exact-match vs ground truth)
        │
        ▼
  Confusion matrix  →  TPR / TNR / Accuracy
```

### Keeping Benchmark Experiments Separate from Task Experiments

When you run a normal experiment, Phoenix tracks it under the **task dataset**
(e.g. `cli-agent-terminal-format`). Benchmark experiments use a **different dataset**
(e.g. `cli-agent-terminal-format-benchmark`) so the two experiment histories stay independent in
the Phoenix UI.

To support this, each dataset definition in `evals/datasets/` carries two names:

```typescript
export const terminalFormatDataset = {
  name: "cli-agent-terminal-format",             // task evaluation dataset
  description: "...",
  benchmarkName: "cli-agent-terminal-format-benchmark",  // evaluator benchmark dataset
  benchmarkDescription: "Golden dataset for benchmarking ...",
  examples: terminalFormatExamples,
};
```

The benchmark script creates or reuses the `benchmarkName` dataset, so every benchmark run
appears as a new experiment under that dataset — completely separate from the experiments that
measure the agent task.

### Project Structure

```
evals/
├── benchmarks/          # Benchmark runners (kebab-case.benchmark.ts)
├── datasets/            # Dataset definitions (name + benchmarkName)
├── evaluators/          # Evaluator definitions
├── experiments/         # Task experiment runners (kebab-case.eval.ts)
└── utils/               # Shared utilities (confusion matrix, stats)
```

### Running a Benchmark

```bash
# Run all benchmarks
pnpm eval:benchmark

# Run a specific benchmark directly
tsx evals/benchmarks/terminal-format.benchmark.ts
```

### How the Benchmark Experiment Works

In a benchmark experiment the roles are inverted compared to a normal experiment:

| Normal experiment | Benchmark experiment |
|-------------------|----------------------|
| Task = agent logic | Task = run the evaluator |
| Evaluators = judge agent output | Evaluator = exact-match against ground truth |
| Dataset = agent input/output pairs | Dataset = golden hand-labeled examples |

The benchmark task calls the evaluator under test and returns its predicted label as the task
output. The exact-match evaluator then compares that prediction to the `metadata.expectedSafe`
ground truth from the golden dataset.

```typescript
// Task: run the evaluator being benchmarked
const task = async (example) => {
  const result = await evaluator.evaluate({
    input: example.input,
    output: example.output.response,
    expected: example.output,
    metadata: example.metadata,
  });
  return result.label ?? "unknown";
};

// Evaluator: compare prediction to ground truth
const exactMatchEvaluator = asExperimentEvaluator({
  name: "exact-match",
  kind: "CODE",
  evaluate: ({ output, metadata }) => {
    const expectedLabel = metadata?.expectedSafe ? "compliant" : "non_compliant";
    const match = output === expectedLabel;
    return { score: match ? 1 : 0, label: output, explanation: `Expected: ${expectedLabel}, Got: ${output}` };
  },
});
```

### Creating a New Benchmark

1. **Add ground truth labels** to your dataset examples via `metadata`:

```typescript
export const myExamples = [
  {
    input: { prompt: "..." },
    output: { response: "plain text answer" },
    metadata: { expectedLabel: "pass", category: "compliant" },
  },
  {
    input: { prompt: "..." },
    output: { response: "**markdown** answer" },
    metadata: { expectedLabel: "fail", category: "violation" },
  },
];
```

2. **Add `benchmarkName`** to your dataset definition:

```typescript
export const myDataset = {
  name: "my-task-dataset",
  description: "Examples used to evaluate the agent task",
  benchmarkName: "my-task-dataset-benchmark",
  benchmarkDescription: "Golden dataset for benchmarking my-evaluator accuracy",
  examples: myExamples,
};
```

3. **Create a benchmark runner** in `evals/benchmarks/my-eval.benchmark.ts`:

```typescript
#!/usr/bin/env tsx
import { createClient } from "@arizeai/phoenix-client";
import { createOrGetDataset, getDatasetExamples } from "@arizeai/phoenix-client/datasets";
import { asExperimentEvaluator, runExperiment } from "@arizeai/phoenix-client/experiments";
import { myDataset } from "../datasets/index.js";
import { myEvaluator } from "../evaluators/index.js";
import { computeConfusionMatrix, printConfusionMatrix, printExperimentSummary } from "../utils/index.js";

async function main() {
  const client = createClient();

  const { datasetId } = await createOrGetDataset({
    client,
    name: myDataset.benchmarkName,          // <-- benchmark dataset, not task dataset
    description: myDataset.benchmarkDescription,
    examples: myDataset.examples,
  });

  const { examples } = await getDatasetExamples({ client, dataset: { datasetId } });

  const groundTruthByExampleId = new Map(
    examples.map((ex) => [ex.id, ex.metadata?.expectedLabel as string])
  );

  const exactMatchEvaluator = asExperimentEvaluator({
    name: "exact-match",
    kind: "CODE",
    evaluate: ({ output, metadata }) => {
      const expected = metadata?.expectedLabel as string;
      const predicted = typeof output === "string" ? output : "unknown";
      return { score: predicted === expected ? 1 : 0, label: predicted, explanation: `Expected: ${expected}, Got: ${predicted}` };
    },
  });

  const experiment = await runExperiment({
    client,
    experimentName: `my-eval-benchmark-${Date.now()}`,
    dataset: { datasetId },
    task: async (example) => {
      const result = await myEvaluator.evaluate({ output: example.output?.response ?? "" });
      return result.label ?? "unknown";
    },
    evaluators: [exactMatchEvaluator],
  });

  printExperimentSummary({ experiment });
  const matrix = computeConfusionMatrix({ experiment, groundTruthByExampleId, evaluatorName: "exact-match", positiveLabel: "pass", negativeLabel: "fail" });
  printConfusionMatrix(matrix);
}

main().catch((error) => { console.error(error); process.exit(1); });
```

### Reading the Confusion Matrix

The benchmark prints a confusion matrix with three key metrics:

| Metric | What it measures | Target |
|--------|-----------------|--------|
| **TPR** (True Positive Rate / Sensitivity) | % of real positives the evaluator correctly identifies | > 80% |
| **TNR** (True Negative Rate / Specificity) | % of real negatives the evaluator correctly rejects | > 80% |
| **Accuracy** | Overall % correct | > 80% |

A low TPR means the evaluator has too many false negatives (lets bad outputs through).
A low TNR means the evaluator has too many false positives (flags good outputs as failures).

### Phoenix UI: Two Separate Dataset Pages

Because benchmarks use a different dataset name, the Phoenix UI shows them on separate pages:

- **`my-task-dataset`** → experiments where the agent task is evaluated
- **`my-task-dataset-benchmark`** → experiments where the evaluator accuracy is measured

This separation lets you iterate on your evaluator (re-run benchmarks, track accuracy over time)
without polluting the history of your agent task experiments.

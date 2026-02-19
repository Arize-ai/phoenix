# Validation: Benchmarking Evaluators (TypeScript)

Measure how accurate an LLM evaluator is by running it against a hand-labeled golden dataset.
Also called **meta-evaluation**. Target >80% TPR and >80% TNR before trusting the evaluator at scale.

## When to Run a Benchmark

- Before deploying an evaluator to production
- After changing the prompt template, model, or scoring criteria
- When TPR or TNR drops unexpectedly in production

## The Mental Model

In a normal experiment the agent is the subject. In a benchmark experiment the evaluator is the subject — the roles are inverted:

| Normal experiment | Benchmark experiment |
|---|---|
| Task = agent logic | Task = run the evaluator |
| Evaluator = judge agent output | Evaluator = exact-match vs ground truth |
| Dataset = agent input/output pairs | Dataset = golden hand-labeled examples |

## Golden Dataset Structure

Each example needs a ground truth label in `metadata`. Aim for ~50/50 pass/fail balance:

```typescript
import type { Example } from "@arizeai/phoenix-client/types/datasets";

export const myGoldenExamples: Example[] = [
  // Positive examples (expected pass)
  {
    input: { prompt: "What is tracing?" },
    output: { response: "Tracing captures execution data using spans." },
    metadata: { expectedPass: true, category: "compliant" },
  },
  // Negative examples (expected fail)
  {
    input: { prompt: "What is tracing?" },
    output: { response: "**Tracing** captures `execution data`." },
    metadata: { expectedPass: false, category: "markdown-violation" },
  },
];
```

## Separate Dataset Naming

Use a distinct `benchmarkName` so benchmark experiments are tracked under their own dataset in
Phoenix — independent from the task evaluation experiments:

```typescript
export const myDataset = {
  name: "my-task-dataset",              // used by task experiments
  description: "Agent evaluation examples",
  benchmarkName: "my-task-dataset-benchmark",   // used by benchmark experiments
  benchmarkDescription: "Golden dataset for benchmarking my-evaluator accuracy",
  examples: myGoldenExamples,
};
```

This separation ensures the Phoenix UI shows two independent experiment histories:
- `my-task-dataset` → how the agent performs over time
- `my-task-dataset-benchmark` → how the evaluator accuracy changes over time

## Full Benchmark Runner

```typescript
#!/usr/bin/env tsx
import { createClient } from "@arizeai/phoenix-client";
import { createOrGetDataset, getDatasetExamples } from "@arizeai/phoenix-client/datasets";
import { asExperimentEvaluator, runExperiment } from "@arizeai/phoenix-client/experiments";
import { myDataset } from "../datasets/index.js";
import { myEvaluator } from "../evaluators/index.js";
import { computeConfusionMatrix, printConfusionMatrix } from "../utils/index.js";

async function main() {
  const client = createClient();

  // 1. Create or reuse the benchmark dataset (separate from task dataset)
  const { datasetId } = await createOrGetDataset({
    client,
    name: myDataset.benchmarkName,
    description: myDataset.benchmarkDescription,
    examples: myDataset.examples,
  });

  // 2. Fetch server-assigned example IDs for ground truth mapping
  const { examples } = await getDatasetExamples({ client, dataset: { datasetId } });
  const groundTruthByExampleId = new Map(
    examples.map((ex) => [
      ex.id,
      ex.metadata?.expectedPass ? "pass" : "fail",
    ])
  );

  // 3. Task: invoke the evaluator under test, return its predicted label
  const task = async (example: (typeof examples)[number]) => {
    const result = await myEvaluator.evaluate({
      input: example.input,
      output: example.output?.response ?? "",
      expected: example.output,
      metadata: example.metadata,
    });
    return result.label ?? "unknown";
  };

  // 4. Exact-match evaluator: score 1 when prediction matches ground truth
  const exactMatch = asExperimentEvaluator({
    name: "exact-match",
    kind: "CODE",
    evaluate: ({ output, metadata }) => {
      const expected = metadata?.expectedPass ? "pass" : "fail";
      const predicted = typeof output === "string" ? output : "unknown";
      return {
        score: predicted === expected ? 1 : 0,
        label: predicted,
        explanation: `Expected: ${expected}, Got: ${predicted}`,
      };
    },
  });

  // 5. Run the benchmark experiment
  const experiment = await runExperiment({
    client,
    experimentName: `my-eval-benchmark-${Date.now()}`,
    experimentDescription: "Benchmark my-evaluator accuracy against golden dataset",
    dataset: { datasetId },
    task,
    evaluators: [exactMatch],
  });

  // 6. Print confusion matrix
  const matrix = computeConfusionMatrix({
    experiment,
    groundTruthByExampleId,
    evaluatorName: "exact-match",
    positiveLabel: "pass",
    negativeLabel: "fail",
  });
  printConfusionMatrix(matrix);
}

main().catch((error) => {
  console.error("Benchmark failed:", error);
  process.exit(1);
});
```

## Reading the Results

| Metric | Meaning | Target | Low value means |
|---|---|---|---|
| **TPR** (sensitivity) | % of real positives correctly identified | >80% | Too many false negatives (misses real failures) |
| **TNR** (specificity) | % of real negatives correctly rejected | >80% | Too many false positives (flags good outputs) |
| **Accuracy** | Overall % correct | >80% | General weakness |

## Golden Dataset Quality Rules

- **Balance**: Aim for ~50/50 pass/fail. Heavy imbalance inflates accuracy while hiding poor TPR or TNR.
- **Coverage**: Include edge cases and boundary examples — they expose where the evaluator is uncertain.
- **Never mutate**: Append new versions (`golden_v2 = [...golden_v1, ...newExamples]`); do not edit existing labels.
- **Human-labeled**: Ground truth must come from human annotation, not another LLM.
- **Small is fine**: 20–50 well-chosen examples reveal more than 500 random ones.

## Benchmark Frequency

Re-run the benchmark after any of these changes:

- Prompt template edited
- Judge model changed (e.g., haiku → sonnet)
- Scoring criteria or class labels updated
- Recurring false positives or negatives reported from production

## See Also

- `validation.md` — Metric definitions and golden dataset construction
- `validation-metrics-typescript.md` — Manual metric calculation utilities
- `experiments-running-typescript.md` — `runExperiment` API reference
- `experiments-datasets-typescript.md` — `createOrGetDataset` / `getDatasetExamples` usage

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

Each example needs a ground truth label in `metadata`. Aim for ~50/50 pass/fail balance. Store the
ground truth in a consistent metadata field — `groundTruthLabel` is a clear, unambiguous name:

```typescript
import type { Example } from "@arizeai/phoenix-client/types/datasets";

const goldenExamples: Example[] = [
  // Positive examples (expected to pass your evaluator)
  {
    input: { question: "What is the capital of France?" },
    output: { answer: "Paris is the capital of France." },
    metadata: { groundTruthLabel: "correct", category: "factual" },
  },
  // Negative examples (expected to fail your evaluator)
  {
    input: { question: "What is the capital of France?" },
    output: { answer: "Lyon is the capital of France." },
    metadata: { groundTruthLabel: "incorrect", category: "factual" },
  },
  // Edge cases expose uncertainty — always include them
  {
    input: { question: "What is the capital of France?" },
    output: { answer: "France has Paris as its most prominent city." },
    metadata: { groundTruthLabel: "incorrect", category: "edge-case" },
  },
];
```

## Separate Dataset Naming

Use a distinct dataset name for benchmarks so their experiments are tracked independently from
task evaluation experiments in the Phoenix UI:

```typescript
const TASK_DATASET_NAME      = "my-app-qa";            // task experiments live here
const BENCHMARK_DATASET_NAME = "my-app-qa-benchmark";  // evaluator benchmarks live here
```

This separation gives you two independent experiment histories:
- `my-app-qa` → how the agent performs over time
- `my-app-qa-benchmark` → how the evaluator accuracy changes over time

## Full Benchmark Runner

```typescript
import { createClient } from "@arizeai/phoenix-client";
import { createOrGetDataset, getDatasetExamples } from "@arizeai/phoenix-client/datasets";
import { asExperimentEvaluator, runExperiment } from "@arizeai/phoenix-client/experiments";

// Replace with your actual evaluator
import { myEvaluator } from "./myEvaluator.js";

const BENCHMARK_DATASET_NAME = "my-app-qa-benchmark";
const POSITIVE_LABEL = "correct";
const NEGATIVE_LABEL = "incorrect";

async function main() {
  const client = createClient();

  // 1. Create or reuse the benchmark dataset (separate from task dataset)
  const { datasetId } = await createOrGetDataset({
    client,
    name: BENCHMARK_DATASET_NAME,
    description: "Golden dataset for benchmarking my-evaluator accuracy",
    examples: goldenExamples,
  });

  // 2. Fetch server-assigned example IDs to build the ground truth map
  const { examples } = await getDatasetExamples({ client, dataset: { datasetId } });
  const groundTruth = new Map<string, string>(
    examples.map((ex) => [ex.id, ex.metadata?.groundTruthLabel as string])
  );

  // 3. Task: invoke the evaluator under test, return its predicted label
  const task = async (example: (typeof examples)[number]) => {
    const result = await myEvaluator.evaluate({
      input: example.input,
      output: example.output,
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
      const expected = metadata?.groundTruthLabel as string;
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

  // 6. Compute and print confusion matrix from experiment results
  const runs = Object.values(experiment.runs);
  const evalRuns = experiment.evaluationRuns ?? [];
  const predictedByRunId = new Map(
    evalRuns
      .filter((e) => e.name === "exact-match")
      .map((e) => [e.experimentRunId, e.result?.label ?? null])
  );

  let tp = 0, fp = 0, tn = 0, fn = 0;
  for (const run of runs) {
    if (run.error) continue;
    const predicted = predictedByRunId.get(run.id);
    const actual = groundTruth.get(run.datasetExampleId);
    if (!predicted || !actual) continue;
    if (actual === POSITIVE_LABEL && predicted === POSITIVE_LABEL) tp++;
    else if (actual === NEGATIVE_LABEL && predicted === POSITIVE_LABEL) fp++;
    else if (actual === NEGATIVE_LABEL && predicted === NEGATIVE_LABEL) tn++;
    else if (actual === POSITIVE_LABEL && predicted === NEGATIVE_LABEL) fn++;
  }

  const total = tp + fp + tn + fn;
  const tpr = tp + fn > 0 ? (tp / (tp + fn)) * 100 : 0;
  const tnr = tn + fp > 0 ? (tn / (tn + fp)) * 100 : 0;
  const accuracy = total > 0 ? ((tp + tn) / total) * 100 : 0;

  console.log(`\nConfusion Matrix (positive="${POSITIVE_LABEL}")`);
  console.log(`  TP=${tp}  FP=${fp}  FN=${fn}  TN=${tn}`);
  console.log(`  TPR: ${tpr.toFixed(1)}%  TNR: ${tnr.toFixed(1)}%  Accuracy: ${accuracy.toFixed(1)}%`);
}

main().catch((error) => {
  console.error("Benchmark failed:", error);
  process.exit(1);
});
```

## Reading the Results

| Metric | Meaning | Target | Low value means |
|---|---|---|---|
| **TPR** (sensitivity) | % of real positives correctly identified | >80% | Too many false negatives — evaluator misses real failures |
| **TNR** (specificity) | % of real negatives correctly rejected | >80% | Too many false positives — evaluator flags good outputs |
| **Accuracy** | Overall % correct | >80% | General weakness across both classes |

## Golden Dataset Quality Rules

- **Balance**: Aim for ~50/50 pass/fail. Heavy imbalance inflates accuracy while hiding poor TPR or TNR.
- **Coverage**: Include edge cases and boundary examples — they expose where the evaluator is uncertain.
- **Human-labeled**: Ground truth must come from human annotation, not another LLM.
- **Never mutate**: Append new versions (`[...goldenV1, ...newExamples]`); do not edit existing labels.
- **Small is fine**: 20–50 well-chosen examples reveal more than 500 random ones.

## Benchmark Frequency

Re-run the benchmark after any of these changes:

- Prompt template edited
- Judge model changed (e.g., haiku → sonnet)
- Scoring criteria or class labels updated
- Recurring false positives or negatives reported from production

## See Also

- `validation.md` — Metric definitions and golden dataset construction principles
- `validation-metrics-typescript.md` — Standalone TPR/TNR calculation utilities
- `experiments-running-typescript.md` — `runExperiment` API reference
- `experiments-datasets-typescript.md` — `createOrGetDataset` / `getDatasetExamples` usage

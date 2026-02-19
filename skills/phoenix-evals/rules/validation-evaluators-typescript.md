# Validating Evaluators (TypeScript)

LLM evaluators are models that can be wrong. Before trusting an evaluator to judge your agent's
outputs at scale, validate it against human-labeled examples. This is **meta-evaluation** — using
a golden dataset to measure your evaluator's accuracy.

Target: **>80% TPR and >80% TNR**.

## The Approach

Build a small golden dataset where you know the correct label, run your evaluator against it
as a Phoenix experiment, and measure how often its predictions match human ground truth.

The experiment roles are inverted compared to a normal task experiment:

| Normal experiment | Evaluator validation experiment |
|---|---|
| Task = agent logic | Task = run the evaluator under test |
| Evaluators = judge agent output | Evaluator = exact-match vs human ground truth |
| Dataset = agent input/output pairs | Dataset = golden hand-labeled examples |

## Golden Dataset

Store human ground truth in `metadata`. Aim for ~50/50 positive/negative balance:

```typescript
import type { Example } from "@arizeai/phoenix-client/types/datasets";

const goldenExamples: Example[] = [
  // Positive examples — evaluator should label these as the positive class
  {
    input: { question: "What is the capital of France?" },
    output: { answer: "Paris is the capital of France." },
    metadata: { groundTruthLabel: "correct" },
  },
  // Negative examples — evaluator should label these as the negative class
  {
    input: { question: "What is the capital of France?" },
    output: { answer: "Lyon is the capital of France." },
    metadata: { groundTruthLabel: "incorrect" },
  },
  // Edge cases expose uncertainty — always include them
  {
    input: { question: "What is the capital of France?" },
    output: { answer: "France has Paris as its most prominent city." },
    metadata: { groundTruthLabel: "incorrect" },
  },
];
```

## Separate Dataset from Task Experiments

Use a distinct dataset name for evaluator validation so these experiments are tracked
independently from your task evaluation experiments in the Phoenix UI:

```typescript
const TASK_DATASET      = "my-app-qa";            // task experiments live here
const VALIDATOR_DATASET = "my-app-qa-evaluator-validation"; // evaluator validation lives here
```

This keeps two independent experiment histories:
- `my-app-qa` → how the agent performs over time
- `my-app-qa-evaluator-validation` → how the evaluator's accuracy changes over time

## Full Validation Experiment

```typescript
import { createClient } from "@arizeai/phoenix-client";
import { createOrGetDataset, getDatasetExamples } from "@arizeai/phoenix-client/datasets";
import { asExperimentEvaluator, runExperiment } from "@arizeai/phoenix-client/experiments";

// Replace with your actual evaluator
import { myEvaluator } from "./myEvaluator.js";

const VALIDATOR_DATASET = "my-app-qa-evaluator-validation";
const POSITIVE_LABEL = "correct";
const NEGATIVE_LABEL = "incorrect";

async function main() {
  const client = createClient();

  // 1. Create or reuse the validation dataset
  const { datasetId } = await createOrGetDataset({
    client,
    name: VALIDATOR_DATASET,
    description: "Golden dataset for validating my-evaluator accuracy",
    examples: goldenExamples,
  });

  // 2. Fetch server-assigned IDs to build the ground truth map
  const { examples } = await getDatasetExamples({ client, dataset: { datasetId } });
  const groundTruth = new Map<string, string>(
    examples.map((ex) => [ex.id, ex.metadata?.groundTruthLabel as string])
  );

  // 3. Task: run the evaluator under test, return its predicted label
  const task = async (example: (typeof examples)[number]) => {
    const result = await myEvaluator.evaluate({
      input: example.input,
      output: example.output,
      expected: example.output,
      metadata: example.metadata,
    });
    return result.label ?? "unknown";
  };

  // 4. Exact-match: score 1 when evaluator prediction matches ground truth
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

  // 5. Run the validation experiment
  const experiment = await runExperiment({
    client,
    experimentName: `evaluator-validation-${Date.now()}`,
    experimentDescription: "Validate my-evaluator accuracy against golden dataset",
    dataset: { datasetId },
    task,
    evaluators: [exactMatch],
  });

  // 6. Compute and print confusion matrix
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

  console.log(`\nEvaluator Validation Results (positive="${POSITIVE_LABEL}")`);
  console.log(`  TP=${tp}  FP=${fp}  FN=${fn}  TN=${tn}`);
  console.log(`  TPR: ${tpr.toFixed(1)}%  TNR: ${tnr.toFixed(1)}%  Accuracy: ${accuracy.toFixed(1)}%`);
}

main().catch((error) => {
  console.error("Validation failed:", error);
  process.exit(1);
});
```

## Reading the Results

| Metric | Meaning | Target | Low value means |
|---|---|---|---|
| **TPR** (sensitivity) | % of real positives the evaluator correctly catches | >80% | Too many false negatives — misses real failures |
| **TNR** (specificity) | % of real negatives the evaluator correctly rejects | >80% | Too many false positives — flags good outputs |
| **Accuracy** | Overall % correct | >80% | General weakness across both classes |

## Standalone Metric Utilities

For quick checks outside of Phoenix experiments:

```typescript
interface ValidationMetrics {
  tp: number; tn: number; fp: number; fn: number;
  tpr: number; tnr: number; accuracy: number;
}

function calculateMetrics(humanLabels: boolean[], predictions: boolean[]): ValidationMetrics {
  let tp = 0, tn = 0, fp = 0, fn = 0;
  for (let i = 0; i < humanLabels.length; i++) {
    if (humanLabels[i] && predictions[i]) tp++;
    else if (!humanLabels[i] && !predictions[i]) tn++;
    else if (!humanLabels[i] && predictions[i]) fp++;
    else fn++;
  }
  return {
    tp, tn, fp, fn,
    tpr: tp / (tp + fn) || 0,
    tnr: tn / (tn + fp) || 0,
    accuracy: (tp + tn) / (tp + tn + fp + fn) || 0,
  };
}

// Adjust a production pass-rate estimate using known evaluator error rates
function correctProductionEstimate(observed: number, tpr: number, tnr: number): number {
  return (observed - (1 - tnr)) / (tpr - (1 - tnr));
}

// Find which examples the evaluator got wrong
function findMisclassified<T>(examples: T[], human: boolean[], pred: boolean[]) {
  const falsePositives: T[] = [], falseNegatives: T[] = [];
  for (let i = 0; i < examples.length; i++) {
    if (pred[i] && !human[i]) falsePositives.push(examples[i]);
    if (!pred[i] && human[i]) falseNegatives.push(examples[i]);
  }
  return { falsePositives, falseNegatives };
}
```

## Golden Dataset Quality Rules

- **Balance**: Aim for ~50/50 positive/negative. Imbalance inflates accuracy while hiding poor TPR or TNR.
- **Coverage**: Include edge cases — they expose where the evaluator is uncertain.
- **Human-labeled**: Ground truth must come from human annotation, not another LLM.
- **Never mutate**: Append new versions (`[...goldenV1, ...newExamples]`); never edit existing labels.
- **Small is fine**: 20–50 well-chosen examples reveal more than 500 random ones.

## Red Flags

- TPR or TNR < 70% — evaluator needs prompt or criteria revision
- Large gap between TPR and TNR — evaluator is biased toward one class
- All outputs are the same label — criteria too lenient or too strict

## When to Re-Validate

- Prompt template edited
- Judge model changed (e.g., haiku → sonnet)
- Scoring criteria or label definitions updated
- Recurring false positives or false negatives reported from production

## See Also

- `validation.md` — Concepts, metric definitions, golden dataset construction principles
- `experiments-running-typescript.md` — `runExperiment` API reference
- `experiments-datasets-typescript.md` — `createOrGetDataset` / `getDatasetExamples` usage

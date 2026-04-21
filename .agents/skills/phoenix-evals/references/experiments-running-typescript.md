# Experiments: Running Experiments in TypeScript

Execute experiments with `runExperiment`.

## Basic Usage

```typescript
import { createClient } from "@arizeai/phoenix-client";
import {
  runExperiment,
  asExperimentEvaluator,
} from "@arizeai/phoenix-client/experiments";

const client = createClient();

const task = async (example: { input: Record<string, unknown> }) => {
  return await callLLM(example.input.question as string);
};

const exactMatch = asExperimentEvaluator({
  name: "exact_match",
  kind: "CODE",
  evaluate: async ({ output, expected }) => ({
    score: output === expected?.answer ? 1.0 : 0.0,
    label: output === expected?.answer ? "match" : "no_match",
  }),
});

const experiment = await runExperiment({
  client,
  experimentName: "qa-experiment-v1",
  dataset: { datasetId: "your-dataset-id" },
  task,
  evaluators: [exactMatch],
});
```

## Task Functions

```typescript
// Basic task
const task = async (example) => await callLLM(example.input.question as string);

// With context (RAG)
const ragTask = async (example) => {
  const prompt = `Context: ${example.input.context}\nQ: ${example.input.question}`;
  return await callLLM(prompt);
};
```

## Evaluator Parameters

```typescript
interface EvaluatorParams {
  input: Record<string, unknown>;
  output: unknown;
  expected: Record<string, unknown>;
  metadata: Record<string, unknown>;
}
```

## Options

```typescript
const experiment = await runExperiment({
  client,
  experimentName: "my-experiment",
  dataset: { datasetName: "qa-test-v1" },
  task,
  evaluators,
  repetitions: 3, // Run each example 3 times
  maxConcurrency: 5, // Limit concurrent executions
});
```

## Stability

Single-run scores are noisy when either the task or the evaluator is non-deterministic (an LLM call, tool use, streaming output, an LLM-as-judge). On a small dataset, run-to-run spread of 0.15-0.25 is common and will swamp the signal from a prompt change.

Average over repetitions so the score you report reflects the prompt, not the sampling noise:

```typescript
await runExperiment({
  // ...
  repetitions: 3,
});
```

Rules of thumb:

- **Always set `repetitions: 3+`** when the task OR the evaluator is an LLM call, and the dataset has fewer than ~30 examples.
- **Repetitions over bigger datasets** when per-example cost is low. 10 examples × 3 reps stabilizes most judges; growing the dataset is more work and adds coverage, not stability.
- **Larger dataset over repetitions** when you need to cover more behaviors, not just reduce noise.
- **No repetitions needed** when task and evaluator are both deterministic (e.g., string comparison against a ground truth). One run is the answer.

Signals you need more stability:

- Two identical runs produce scores more than 0.10 apart.
- A prompt change flips an example between accurate/partial but the outputs look equivalent.
- The judge's rationale contradicts itself across runs on the same output.

Repetitions are also what `repetitions: 1` (default) silently relies on — don't trust a tuning decision based on a single 10-example run.

## Add Evaluations Later

```typescript
import { evaluateExperiment } from "@arizeai/phoenix-client/experiments";

await evaluateExperiment({ client, experiment, evaluators: [newEvaluator] });
```

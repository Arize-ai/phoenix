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

## Tracing AI SDK Calls Inside Tasks

`@arizeai/phoenix-client` 7.x requires AI SDK v7, which **no longer emits
OpenTelemetry spans through the global tracer provider on its own**. If your task
calls `generateText`/`streamText`, pass the `@ai-sdk/otel` integration per call and
**construct it inside the task**:

```typescript
import { openai } from "@ai-sdk/openai";
import { OpenTelemetry } from "@ai-sdk/otel";
import { runExperiment } from "@arizeai/phoenix-client/experiments";
import type { ExperimentTask } from "@arizeai/phoenix-client/types/experiments";
import { generateText } from "ai";

const model = openai("gpt-4o-mini");

const task: ExperimentTask = async (example) => {
  const { text } = await generateText({
    model,
    prompt: String(example.input.question),
    telemetry: { integrations: [new OpenTelemetry()] },
  });
  return text;
};
```

**Why inside the task:** the integration binds to whichever tracer provider is
active when it is *constructed*, and `runExperiment` mounts the experiment's
provider only while tasks run. An integration registered once at startup via
`registerTelemetry` binds before that provider exists, and the task spans are lost.
This is the opposite of ordinary application tracing, where startup registration is
correct.

Evaluators from `@arizeai/phoenix-evals` are traced automatically and need no
telemetry setup.

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

Single-run scores are noisy when either the task or the evaluator is non-deterministic — an LLM call, tool use, streaming output, an LLM-as-judge. On a small dataset, that per-run noise can swamp the signal from a prompt change.

Averaging over repetitions lets the score you report reflect the prompt rather than the sampling noise:

```typescript
await runExperiment({
  // ...
  repetitions: 3,
});
```

Things to consider:

- Reach for repetitions when the task or the evaluator is an LLM call and the dataset is small.
- Prefer repetitions when per-example cost is low and you mostly want to settle the score; prefer growing the dataset when you also need to cover more behaviors.
- Skip repetitions when both the task and the evaluator are deterministic (e.g. string comparison against a ground truth) — a single run is the answer.

Consider adding stability when:

- Repeat runs of the same experiment drift in ways that feel larger than the differences you're trying to measure.
- A prompt change flips example labels in ways that don't track with how the outputs actually changed.
- The judge's reasoning on the same output reads differently from one run to the next.

Repetitions are also what `repetitions: 1` (default) silently relies on — don't trust a tuning decision based on a single 10-example run.

## Add Evaluations Later

```typescript
import { evaluateExperiment } from "@arizeai/phoenix-client/experiments";

await evaluateExperiment({ client, experiment, evaluators: [newEvaluator] });
```

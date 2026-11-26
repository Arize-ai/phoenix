# Experiments in TypeScript

## Run an experiment

```typescript
import { openai } from "@ai-sdk/openai";
import { createClient } from "@arizeai/phoenix-client";
import { asExperimentEvaluator, runExperiment } from "@arizeai/phoenix-client/experiments";
import type { ExperimentTask } from "@arizeai/phoenix-client/types/experiments";
import { createClassificationEvaluator } from "@arizeai/phoenix-evals";

const client = createClient();

const task: ExperimentTask = async (example) => {
  return await answerQuestion(String(example.input.question));
};

const under100Words = asExperimentEvaluator({
  name: "under_100_words",
  kind: "CODE",
  evaluate: async ({ output }) => {
    const passed = String(output).split(/\s+/).length <= 100;
    return { score: passed ? 1 : 0, label: passed ? "pass" : "fail" };
  },
});

const matchesReference = createClassificationEvaluator({
  name: "matches_reference",
  model: openai("gpt-4o"),
  promptTemplate: `Reference answer: {{expected.answer}}
Candidate answer: {{output}}
"match": the candidate gives the same decision and facts as the reference.
"mismatch": it contradicts the reference or leaves out its decision.`,
  choices: { match: 1, mismatch: 0 },
});

const experiment = await runExperiment({
  client,
  dataset: { datasetName: "recipe-faq" },
  task,
  evaluators: [under100Words, matchesReference],
  experimentName: "system-prompt-v2",
  experimentDescription: "Asks for shorter answers in the system prompt",
  experimentMetadata: { promptVersion: "v2" },
  repetitions: 3,
  concurrency: 5,
});
```

- Evaluators receive `{ input, output, expected?, metadata?, traceId? }`. `expected`
  is the example's whole reference output object.
- `@arizeai/phoenix-evals` evaluators go straight into `evaluators`. Use
  `asExperimentEvaluator` for a custom function; its `kind` is `"CODE"`, `"LLM"`,
  `"HUMAN"`, `"DECISION"`, or `"AGENT"`.
- `dataset` takes `{ datasetName }` or `{ datasetId }`, optionally with `versionId`
  and `splits`.

### Options

| Option | Default | Use |
| ------ | ------- | --- |
| `repetitions` | 1 | Runs each example several times. Use 3 or more when the task or a judge calls an LLM. |
| `concurrency` | 5 | Tasks running at once. |
| `dryRun` | `false` | `true` or a number runs that many examples without recording anything. |
| `record` | `true` | `false` runs without writing to Phoenix. |
| `setGlobalTracerProvider` | `true` | Registers the experiment's tracer provider while tasks run. |

## Trace AI SDK calls inside a task

AI SDK v7 doesn't send spans to the global tracer provider by itself. Construct the
`@ai-sdk/otel` integration inside the task, because `runExperiment` mounts its
tracer provider only while tasks run:

```typescript
import { OpenTelemetry } from "@ai-sdk/otel";
import { generateText } from "ai";

const tracedTask: ExperimentTask = async (example) => {
  const { text } = await generateText({
    model: openai("gpt-6-luna"),
    prompt: String(example.input.question),
    telemetry: { integrations: [new OpenTelemetry()] },
  });
  return text;
};
```

An integration registered once at startup binds before the experiment's provider
exists, and the task spans are lost. Evaluators from `@arizeai/phoenix-evals` trace
themselves.

## Read the results

`runExperiment` returns a `RanExperiment`: the experiment's `id`, `datasetId`, and
`datasetVersionId`, `runs` (a record of run ID to run, each with `datasetExampleId`,
`output`, and `error`), and `evaluationRuns` (each with `experimentRunId`, `name`,
`result` with `score`, `label`, and `explanation`, and `error`).

```typescript
import { getExperiment, listExperiments } from "@arizeai/phoenix-client/experiments";

const saved = await getExperiment({ client, experimentId: "EXPERIMENT_ID" });
const experiments = await listExperiments({ client, datasetId: "DATASET_ID" });
```

Compute pass rates from `evaluationRuns`; see
[compare-experiments](compare-experiments.md).

## Add evaluations later, or finish an interrupted run

```typescript
import {
  evaluateExperiment,
  resumeEvaluation,
  resumeExperiment,
} from "@arizeai/phoenix-client/experiments";

await evaluateExperiment({ client, experiment, evaluators: [under100Words] });
await resumeExperiment({ client, experimentId: "EXPERIMENT_ID", task, evaluators: [matchesReference] });
await resumeEvaluation({ client, experimentId: "EXPERIMENT_ID", evaluators: [matchesReference] });
```

- `evaluateExperiment` scores every run again and replaces evaluations with the same
  name.
- `resumeExperiment` reruns only missing or failed runs, then fills in missing
  evaluations. On servers older than 20.21.3, a replaced run keeps its stale evaluations.
- `resumeEvaluation` runs evaluators only where that evaluation is missing or failed,
  matching by name.

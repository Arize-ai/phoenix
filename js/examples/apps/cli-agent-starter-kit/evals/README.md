# Agent Evaluation Harness

Automated evaluation for the Phoenix Documentation Assistant CLI agent, built on
the [Phoenix Vitest reporter](https://arize.com/docs/phoenix/evaluation/integrations/vitest-jest).
Each eval is an ordinary Vitest suite written with the `@arizeai/phoenix-client/vitest`
API; the reporter records every case to Phoenix as an experiment run and prints a
summary (plus dataset/experiment links) at the end.

## New here? Start with one file

Open **`experiments/terminal-format.eval.ts`** and read it top to bottom — its
header walks through the five steps of a single eval case. Then run it:

```bash
pnpm phoenix:start     # local Phoenix at http://localhost:6006 (Docker)
cp .env.example .env   # add your ANTHROPIC_API_KEY
pnpm eval:task         # run just that suite; open the printed Experiment link
```

When that makes sense, read `benchmarks/terminal-format.benchmark.ts` — same
machinery, but it grades the _judge_ instead of the agent.

### How a run actually starts

There is **no runner script** and no `main()` — the test files are the entrypoints.
`pnpm eval` simply runs `vitest`, which:

1. reads `vitest.config.ts` and matches the `evals/**/*.eval.ts` and
   `evals/**/*.benchmark.ts` globs,
2. loads `evals/vitest.setup.ts` (registers Phoenix tracing, loads `.env`),
3. runs each discovered suite, and
4. the Phoenix reporter prints a summary with dataset/experiment links.

To add a new eval, you don't wire it up anywhere — just drop a `*.eval.ts` file
under `evals/` and it's picked up automatically.

## Quick Start

```bash
pnpm eval              # Run all eval suites, record to Phoenix
pnpm eval:offline      # Run without recording (PHOENIX_TEST_TRACKING=false)
pnpm eval:watch        # Re-run on change while iterating
pnpm eval:task         # Just the agent task eval  (experiments/)
pnpm eval:benchmark    # Just the evaluator benchmark (benchmarks/)
```

`pnpm eval` does not start Phoenix for you. Bring up a local instance first with
`pnpm phoenix:start`, point `PHOENIX_COLLECTOR_ENDPOINT` at a remote one, or use
`pnpm eval:offline` to iterate with nothing recorded.

`ANTHROPIC_API_KEY` is required (the agent and the LLM judge both call Anthropic).
The suites read it from `.env` via dotenv — copy `.env.example` to `.env`.

## Available Evaluations

- **Terminal Safe Format** (`experiments/terminal-format.eval.ts`) — calls the real
  agent and judges whether each response is terminal-safe (plain text / ANSI, no
  markdown) using the `terminal-safe-format` LLM classifier.
- **Terminal Format Benchmark** (`benchmarks/terminal-format.benchmark.ts`) — a
  meta-eval that measures how accurate the `terminal-safe-format` judge itself is
  against a golden dataset (see [Benchmarking](#benchmarking-evaluating-the-evaluators)).

## Project Structure

```
evals/
├── evaluators/          # Evaluator definitions (camelCase)
├── datasets/            # Test datasets (camelCase)
├── experiments/         # Task eval suites      (kebab-case.eval.ts)
├── benchmarks/          # Evaluator benchmarks   (kebab-case.benchmark.ts)
├── utils/               # Shared utilities (confusion matrix)
└── vitest.setup.ts      # Registers Phoenix tracing + flushes spans per suite
```

Both `*.eval.ts` and `*.benchmark.ts` are picked up by `vitest.config.ts` and
recorded by the Phoenix reporter.

## Anatomy of a Task Eval

A task eval runs the **agent** and scores its output with an **evaluator**. The
suite is gated on aggregate `acceptanceCriteria` rather than a hard assertion per
case, so a single off LLM response doesn't fail CI — a downward trend does.

```typescript
import * as px from "@arizeai/phoenix-client/vitest";

import { agent } from "../../src/agents/index.js";
import { runInteraction } from "../../src/ui/interaction.js";
import { createTerminalSafeFormatEvaluator } from "../evaluators/index.js";

const judge = createTerminalSafeFormatEvaluator();

px.describe(
  "cli-agent terminal format",
  () => {
    px.test.each([
      { id: "install", input: { prompt: "How do I install Phoenix?" } },
    ])(
      (row) => row.id ?? "case",
      async ({ input }) => {
        const { text } = await runInteraction({ input: input.prompt, agent });
        px.logOutput({ response: text });
        // The judge template interpolates {{output}} as a string, so pass it explicitly.
        await px.evaluate(await judge, { output: text });
      }
    );
  },
  {
    datasetName: "cli-agent-terminal-format",
    acceptanceCriteria: [
      {
        annotationName: "terminal-safe-format",
        metric: "passRate",
        passFn: (a) => a.score === 1,
        minPassRate: 0.7,
      },
    ],
  }
);
```

`px.logOutput` records the run's output, `px.evaluate(evaluator)` runs an
evaluator and stores its result as an annotation, and `px.logAnnotation` records a
code metric (e.g. `latency_ms`) directly.

## Creating an Evaluator

Evaluators are plain `@arizeai/phoenix-evals` objects — anything with
`{ name, evaluate }` works with `px.evaluate`. Create one in
`evals/evaluators/myEvaluator.ts`:

```typescript
import { anthropic } from "@ai-sdk/anthropic-v5";
import { createClassificationEvaluator } from "@arizeai/phoenix-evals";

export function createMyEvaluator() {
  return createClassificationEvaluator<{ output: string }>({
    name: "my-evaluator",
    model: anthropic("claude-haiku-4-5"),
    choices: { bad: 0, good: 1 },
    promptTemplate: `Judge the response.\n<response>{{output}}</response>\nAnswer (good/bad):`,
  });
}
```

Then export it from `evals/evaluators/index.ts` and use it in a suite.

## Benchmarking: Evaluating the Evaluators

LLM-based evaluators are themselves models that can make mistakes. Before you rely
on one to judge your agent at scale, measure how accurate it is against a **golden
dataset** — a small set of hand-labeled examples. A well-calibrated evaluator
should reach **> 80% TPR and > 80% TNR**.

In a benchmark the roles invert:

| Task eval                          | Benchmark                                |
| ---------------------------------- | ---------------------------------------- |
| Task = agent logic                 | Task = run the evaluator under test      |
| Evaluator = judge agent output     | Score = exact-match against ground truth |
| Dataset = agent input/output pairs | Dataset = golden hand-labeled examples   |

Each golden example carries its ground-truth label in `metadata` (here,
`expectedSafe`). The benchmark suite runs the judge on the pre-labeled response,
records the predicted label, and scores an `exact_match` annotation against the
ground truth. The suite is gated on accuracy via `acceptanceCriteria`
(`passRate ≥ 0.8`), and an `afterAll` hook prints a confusion matrix with
TPR / TNR / accuracy (see `utils/confusionMatrix.ts`).

```typescript
const { label: predicted } = await (await judge).evaluate({ output: response });
const expectedLabel = metadata?.expectedSafe ? "compliant" : "non_compliant";

px.logOutput({ predicted, expected: expectedLabel });
px.logAnnotation({
  name: "exact_match",
  score: predicted === expectedLabel ? 1 : 0,
  label: predicted ?? "unknown",
  annotatorKind: "CODE",
});
```

### Keeping Benchmarks Separate from Task Experiments

The benchmark suite sets `datasetName` to a dedicated benchmark dataset
(`cli-agent-terminal-format-benchmark`) so its experiment history stays separate
from the agent task experiments in the Phoenix UI. Each dataset definition in
`evals/datasets/` carries both names:

```typescript
export const terminalFormatDataset = {
  name: "cli-agent-terminal-format", // task eval dataset
  benchmarkName: "cli-agent-terminal-format-benchmark", // benchmark dataset
  // ...
};
```

### Reading the Confusion Matrix

| Metric                | What it measures                                       | Target |
| --------------------- | ------------------------------------------------------ | ------ |
| **TPR** (Sensitivity) | % of real positives the evaluator correctly identifies | > 80%  |
| **TNR** (Specificity) | % of real negatives the evaluator correctly rejects    | > 80%  |
| **Accuracy**          | Overall % correct                                      | > 80%  |

A low TPR means too many false negatives (bad outputs slip through). A low TNR
means too many false positives (good outputs flagged as failures).

## View Results

http://localhost:6006/datasets — the reporter prints the exact dataset and
experiment links at the end of each run.

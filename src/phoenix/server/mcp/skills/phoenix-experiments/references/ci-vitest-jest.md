# Gate CI with Vitest or Jest

Write evals as ordinary Vitest or Jest suites that record to Phoenix as experiments and gate CI. The integration maps the test runner onto Phoenix like this:

- Each `describe()` becomes a dataset and an experiment.
- Each `test()` becomes an example and an experiment run.
- Each assert outcome becomes a `pass` annotation.

LLM calls instrumented with OpenInference appear as child spans of each test's task.

Requires `@arizeai/phoenix-client` 8.x and Node.js 22.15 or later. Add
`@arizeai/phoenix-evals` and an AI SDK v7 provider when the suite uses library
evaluators. The testing API is in beta and might change.

## When to use the test runner instead of `runExperiment`

Use the test-runner integration when you already use Vitest or Jest, for `test.each`, `.only`, `.skip`, or mocks, and one of these applies:

- Each case needs different logic.
- You want a hard `expect()` gate.
- You want [acceptance criteria](#acceptance-criteria) to gate CI on aggregate scores.

Prefer `runExperiment` for large datasets where every example is scored the same way.

## Install

```bash
npm install -D @arizeai/phoenix-client@^8 @arizeai/phoenix-evals dotenv
```

`@arizeai/phoenix-client` bundles the Vitest and Jest entry points.

## Keep eval suites in a separate config

```ts
// phoenix.vitest.config.ts
import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    include: ["**/*.eval.?(c|m)[jt]s"],
    reporters: ["default", "@arizeai/phoenix-client/vitest/reporter"],
    setupFiles: ["dotenv/config"],  // Loads PHOENIX_ENDPOINT, PHOENIX_API_KEY, and other variables.
    testTimeout: 30_000,            // LLM calls are slow.
  },
});
```

For Jest, create `phoenix.jest.config.cjs` with `testMatch`, `reporters: ["default", "@arizeai/phoenix-client/jest/reporter"]`, and `setupFiles: ["dotenv/config"]`. Add `"eval": "vitest run --config phoenix.vitest.config.ts"`, or `jest --config ...`, to `package.json`. The `jsdom` environment isn't supported. Use `node`.

## Minimal suite

```ts
import * as px from "@arizeai/phoenix-client/vitest"; // Or .../jest.
import { expect } from "vitest";

px.describe("answer quality", () => {
  px.test(
    "capital city",
    { input: { question: "Capital of France?" }, expected: { answer: "Paris" } },
    async ({ input, expected }) => {
      const result = await myApp(input.question);
      px.logOutput({ answer: result });
      expect(result).toContain(expected?.answer ?? "");
    },
  );
});
```

You can pass the reference output as `expected`, `reference`, or `output`. The test body receives it as `expected` in every case. `it` is an alias for `test`.

Use `px.test.each(rows)` for larger datasets. To run against an existing Phoenix dataset, load rows with `getDatasetExamples`, which needs top-level `await` and ESM. Keep each example's `id` so runs upsert onto the same example.

## Logging helpers

- `px.logOutput(value)`: records the run output as `ExperimentRun.output`.
- `px.logAnnotation({ name, score, label?, explanation?, metadata?, annotatorKind? })`: records a named inline score. `score` can be a number or a boolean, and booleans are stored as 0 or 1. `annotatorKind` is `"LLM" | "CODE" | "HUMAN" | "DECISION" | "AGENT"`. Default: `"CODE"`.
- `px.evaluate(evaluator, params?)`: runs an `@arizeai/phoenix-evals` evaluator and records an annotation and a linked evaluator trace. If you omit `params`, the test's `input`, `output`, `expected`, `metadata`, and `traceId` are passed automatically.
- `px.traceEvaluator(fn, options?)`: wraps a plain grading function so it runs in its own evaluator span, and records a returned `{ name, score }` as an annotation. It passes your arguments through unchanged and doesn't supply any automatically.

## Two kinds of checks: invariants and signals

Every eval suite has to decide which checks gate CI and which only show a trend.

- **Hard invariants.** Behavior with exactly one acceptable outcome that code can verify, such as a required refusal, valid JSON, or a tool that must be called. Use a per-case `expect()`. A failure fails the run and fails CI.
- **Quality signals.** Answers that can be better or worse with no single correct string, such as helpfulness, groundedness, or tone. Record them with `evaluate()` or `logAnnotation()`. An `acceptanceCriteria` gate usually handles these better than a per-case `expect()` because both the app and the judge can vary. Use a per-case gate when that case must block the build and you've checked that the evaluator is reliable enough for the decision.

In this runner, per-case `expect()` calls fit invariants, and `acceptanceCriteria` fits aggregate quality signals.

## LLM-as-a-judge inside a suite

The simplest judge is a `createClassificationEvaluator` from `@arizeai/phoenix-evals`. It returns a label mapped to a numeric score, which Phoenix records as an annotation under a linked evaluator span. Pass the judge only what it needs to grade, as the second argument to `px.evaluate()`, with keys that match the template variables. You don't need `inputMapping` for this. For structured records or pre-built evaluators, use `inputMapping` to map fields onto template variables instead. The judge runs on its own model, configured separately from the system under test. For setup, see phoenix-evals.

```ts
import { anthropic } from "@ai-sdk/anthropic";
import * as px from "@arizeai/phoenix-client/vitest";
import { createClassificationEvaluator } from "@arizeai/phoenix-evals";
import { expect } from "vitest";

const helpfulness = createClassificationEvaluator({
  name: "helpfulness",
  model: anthropic("claude-sonnet-4-6"),
  choices: { helpful: 1, unhelpful: 0 },
  promptTemplate: `Question: {{question}}\n\nResponse: {{response}}\n\nLabel "helpful" if it accurately answers the question, else "unhelpful".`,
});

const CASES = [
  { id: "refund", input: { question: "How do I get a refund?", expectRefusal: false } },
  { id: "offtopic", input: { question: "What's the capital of France?", expectRefusal: true } },
];

px.describe(
  "support bot",
  () => {
    px.test.each(CASES)((row) => row.id ?? String(row.input.question), async ({ input }) => {
      const start = performance.now();
      const response = await answerQuestion(String(input.question));

      px.logOutput({ response });
      px.logAnnotation({ name: "latency_ms", score: performance.now() - start, annotatorKind: "CODE" });

      if (input.expectRefusal) {
        expect(response).toContain("I don't have information on that");  // Hard invariant.
      } else {
        // Quality signal. Not asserted here; acceptanceCriteria below gates it.
        await px.evaluate(helpfulness, { question: String(input.question), response });
      }
    });
  },
  {
    acceptanceCriteria: [
      // Signal gate on judged answers.
      { annotationName: "helpfulness", metric: "passRate", passFn: (a) => a.score === 1, minPassRate: 0.7 },
      // Latency budget gate.
      { annotationName: "latency_ms", metric: "average", threshold: 5000, direction: "minimize" },
    ],
  },
);
```

In this suite, the refusal stays a per-case `expect()` because it's an invariant. Helpfulness and latency are signals, so they move into `acceptanceCriteria`. `passFn` receives the full annotation, so you can gate on `score`, `label`, or `explanation`. To judge groundedness, add a `{{context}}` variable and pass it too, or use `createFaithfulnessEvaluator`.

## Acceptance criteria

Acceptance criteria are suite-level gates that the runner checks after all tests finish. Every case runs first, and the full scorecard prints before the suite fails. Pass them as the third argument to `describe`:

```ts
px.describe("text-to-sql", () => { /* tests log token_f1, valid_sql, latency_ms */ }, {
  acceptanceCriteria: [
    { annotationName: "token_f1", metric: "average", threshold: 0.8 },
    { annotationName: "token_f1", metric: "passRate",
      passFn: (a) => typeof a.score === "number" && a.score >= 0.7, minPassRate: 0.9 },
    { annotationName: "valid_sql", metric: "passRate", passFn: (a) => a.score === true, minPassRate: 1 },
    { annotationName: "latency_ms", metric: "average", threshold: 800, direction: "minimize" },
  ],
});
```

- `metric: "average"` checks the mean against `threshold`. `direction` is `"maximize"`, the default, which passes at `>=`, or `"minimize"`, which passes at `<=`. Use `"minimize"` for latency, cost, and error counts.
- `metric: "passRate"` counts the runs where `passFn(annotation)` returns true and requires that fraction to reach `minPassRate`. A `minPassRate` of `1` means every run. `passFn` receives the full annotation: `score`, `label`, `explanation`, and `metadata`.
- A criterion covers only the runs that logged its annotation. A run that never logs it, such as a test that threw before `logAnnotation()`, is left out rather than counted as a failure, because the thrown test already fails in Vitest or Jest. The scorecard shows coverage as `sampleCount` of `eligibleRunCount` non-skipped runs, for example `PASS token_f1 average 0.840 (need >= 0.800; 70 of 100 runs)`, so low coverage is visible even when the gate passes.

## Suite and test options

`describe(name, fn, opts)` accepts these options: `datasetName`, `description`, `metadata`, `client` (a custom `createClient`), `repetitions`, `dryRun`, and `acceptanceCriteria`.

Each test or row accepts these fields alongside `input`: `id` (a stable example ID for upserts), `metadata`, `splits`, `repetitions`, `dryRun`, and `config: { tags, metadata }`.

## Environment variables

| Variable | Purpose |
|---|---|
| `PHOENIX_ENDPOINT` | Phoenix base URL. Usually the same URL as `PHOENIX_COLLECTOR_ENDPOINT`, which the client uses when this variable is unset. |
| `PHOENIX_API_KEY` | Bearer token |
| `PHOENIX_CLIENT_HEADERS` | Optional JSON headers |
| `PHOENIX_TEST_TRACKING` | `false` turns off sync, which makes every run a dry run. |
| `PHOENIX_TEST_REPETITIONS` | Default repetitions per test |
| `PHOENIX_TEST_REPORTER` | `verbose` shows every row and each test's output. |

To dry-run, use `PHOENIX_TEST_TRACKING=false npm run eval`, or set `{ dryRun: true }` on a suite or test. Tests skipped with `.skip` are never recorded. To run tests locally without recording them, use a dry run.

## CI gate with GitHub Actions

The runner's exit code is the gate. A failed `expect()` or acceptance criterion makes the runner exit with a nonzero code.

```yaml
name: eval-ci
on:
  pull_request:
jobs:
  evals:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "22"
      - run: npm ci
      - name: Run eval suite
        env:
          PHOENIX_ENDPOINT: ${{ secrets.PHOENIX_ENDPOINT }}
          PHOENIX_API_KEY: ${{ secrets.PHOENIX_API_KEY }}
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
        run: npm run eval
```

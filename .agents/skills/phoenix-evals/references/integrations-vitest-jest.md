# Integrations: Vitest / Jest (TypeScript)

Write evals as ordinary Vitest or Jest suites that record to Phoenix as experiments and gate CI. Each `describe()` → a dataset + experiment; each `test()` → an example + experiment run; the assert outcome → a `pass` annotation. OpenInference-instrumented LLM calls appear as child spans of each test's task.

Requires `@arizeai/phoenix-client>=6.11.1`. The testing API is **beta** and may change.

## When to use vs `runExperiment`

Use the test-runner integration when each case needs different logic, you want a hard `expect()` gate, or you want [acceptance criteria](#acceptance-criteria) to gate CI on aggregate scores — and you already use Vitest/Jest (`test.each`, `.only`/`.skip`, mocks). Prefer `runExperiment` for large, homogeneous datasets scored the same way.

## Install

```bash
npm install -D @arizeai/phoenix-client@^6.11.1 @arizeai/phoenix-evals dotenv
```

Vitest and Jest entrypoints are bundled in `@arizeai/phoenix-client`.

## Config (keep eval suites separate)

```ts
// phoenix.vitest.config.ts
import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    include: ["**/*.eval.?(c|m)[jt]s"],
    reporters: ["default", "@arizeai/phoenix-client/vitest/reporter"],
    setupFiles: ["dotenv/config"],  // loads PHOENIX_HOST, PHOENIX_API_KEY, ...
    testTimeout: 30_000,            // LLM calls are slow
  },
});
```

Jest equivalent: `phoenix.jest.config.cjs` with `testMatch`, `reporters: ["default", "@arizeai/phoenix-client/jest/reporter"]`, `setupFiles: ["dotenv/config"]`. Add `"eval": "vitest run --config phoenix.vitest.config.ts"` (or `jest --config ...`) to `package.json`. **`jsdom` is not supported** — use `node`.

## Minimal suite

```ts
import * as px from "@arizeai/phoenix-client/vitest"; // or .../jest
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

Reference output accepts any one of `expected`, `reference`, or `output` — all arrive as `expected` in the test body. `it` is an alias for `test`.

Use `px.test.each(rows)` for larger datasets. To run against an existing Phoenix dataset, load rows with `getDatasetExamples` (top-level `await`, ESM) and keep each example's `id` so runs upsert onto the same example.

## Logging helpers

- `px.logOutput(value)` — records the run output (`ExperimentRun.output`).
- `px.logAnnotation({ name, score, label?, explanation?, metadata?, annotatorKind? })` — inline named score. `score` may be number or boolean (bools stored as 0/1); `annotatorKind` is `"LLM" | "CODE" | "HUMAN"` (default `"CODE"`).
- `px.evaluate(evaluator, params?)` — runs an `@arizeai/phoenix-evals` evaluator, records an annotation + linked evaluator trace. Omit `params` to auto-supply the test's `input`/`output`/`expected`/`metadata`/`traceId`.
- `px.traceEvaluator(fn, options?)` — wrap a plain grading fn; runs in its own evaluator span and captures a returned `{ name, score }` as an annotation. Passes through your args (no auto-supply).

## Two kinds of checks: invariants vs. signals

The decision that shapes every eval suite is which checks gate CI and which only trend.

- **Hard invariants** — exactly one acceptable behavior, verifiable in code (a required refusal, valid JSON, a tool that must fire). Use a per-case `expect()`. A failure fails the run and turns CI red.
- **Quality signals** — answers on a spectrum with no single correct string (helpfulness, groundedness, tone). Score with an LLM judge and record via `evaluate()`/`logAnnotation()` — do *not* `expect()` per case. Gate them at the **suite** level with `acceptanceCriteria` so aggregate quality (e.g. ≥70% helpful) holds the line while a single weak answer doesn't break the build.

This is the natural division of labor in this runner: invariants → per-case `expect()`; signals → `acceptanceCriteria`.

## LLM-as-a-judge inside a suite

The cleanest judge is a `createClassificationEvaluator` from `@arizeai/phoenix-evals`: it emits a label mapped to a numeric score (recorded as an annotation under a linked evaluator span). Pass the judge only what it needs to grade as the second arg to `px.evaluate()`, matching the template vars — no `inputMapping` needed. (For structured records or pre-built evaluators, `inputMapping` projects fields onto template vars instead.) The judge runs on its own model, configured independently of the system under test (see configuring the judge LLM).

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

px.describe(
  "support bot",
  () => {
    px.test.each(CASES)((row) => row.id, async ({ input }) => {
      const start = performance.now();
      const response = await answerQuestion(input.question);

      px.logOutput({ response });
      px.logAnnotation({ name: "latency_ms", score: performance.now() - start, annotatorKind: "CODE" });

      if (input.expectRefusal) {
        expect(response).toContain("I don't have information on that");  // hard invariant
      } else {
        // Quality signal — NOT asserted; gated by acceptanceCriteria below.
        await px.evaluate(helpfulness, { question: input.question, response });
      }
    });
  },
  {
    acceptanceCriteria: [
      // signal gate: ≥70% of judged answers must score helpful
      { annotationName: "helpfulness", metric: "passRate", passFn: (a) => a.score === 1, minPassRate: 0.7 },
      // budget gate: mean latency under 5s
      { annotationName: "latency_ms", metric: "average", threshold: 5000, direction: "minimize" },
    ],
  },
);
```

The refusal stays a per-case `expect()` (invariant); helpfulness and latency move into `acceptanceCriteria` (signals). `passFn` receives the full annotation, so you can gate on `score`, `label`, or `explanation`. For *groundedness*, add a `{{context}}` var and pass it too, or use `createFaithfulnessEvaluator`.

## Acceptance criteria

Suite-level gates evaluated **after** all tests (every case runs first, full scorecard prints before failing). Pass as `describe`'s third arg:

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

- `metric: "average"` checks the mean against `threshold`; `direction` is `"maximize"` (default, clears at `>=`) or `"minimize"` (latency/cost/errors, clears at `<=`).
- `metric: "passRate"` counts runs where `passFn(annotation)` is true and requires that fraction to reach `minPassRate` (`1` = all). `passFn` receives the full annotation (`score`, `label`, `explanation`, `metadata`).

## Suite & test config

`describe(name, fn, opts)` opts: `datasetName`, `description`, `metadata`, `client` (custom `createClient`), `repetitions`, `dryRun`, `acceptanceCriteria`. Per-test/per-row fields alongside `input`: `id` (stable example id for upsert), `metadata`, `splits`, `repetitions`, `dryRun`, `config: { tags, metadata }`.

## Environment variables

| Variable | Purpose |
|---|---|
| `PHOENIX_HOST` | Phoenix base URL (the client reads this for `baseUrl` — **not** `PHOENIX_COLLECTOR_ENDPOINT`) |
| `PHOENIX_API_KEY` | Bearer token |
| `PHOENIX_CLIENT_HEADERS` | Optional JSON headers |
| `PHOENIX_TEST_TRACKING` | `false` disables sync (dry run) |
| `PHOENIX_TEST_REPETITIONS` | Default repetitions per test |
| `PHOENIX_TEST_REPORTER` | `verbose` shows every row + per-test output |

Dry run: `PHOENIX_TEST_TRACKING=false npm run eval`, or `{ dryRun: true }` per suite/test. Skipped (`.skip`) tests are never recorded; use dry-run to track locally without recording.

## CI gate (GitHub Actions)

The runner's exit code is the gate — a failed `expect()` or acceptance criterion exits nonzero.

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
          node-version: "20"
      - run: npm ci
      - name: Run eval suite
        env:
          PHOENIX_HOST: ${{ secrets.PHOENIX_HOST }}
          PHOENIX_API_KEY: ${{ secrets.PHOENIX_API_KEY }}
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
        run: npm run eval
```

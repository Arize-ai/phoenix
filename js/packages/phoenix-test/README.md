# @arizeai/phoenix-test

Run dataset-backed evaluations as Vitest or Jest tests, syncing inputs,
outputs, and annotations to [Arize Phoenix](https://docs.arize.com/phoenix).

Each `describe()` block becomes a Phoenix dataset and a new experiment;
each `test()` becomes a dataset example plus a recorded experiment run;
each assertion becomes a `pass` boolean annotation. Anything you log via
`logOutput()` / `logAnnotation()` / `wrapEvaluator()` lands on the run.

Tracing is provided by `@arizeai/phoenix-otel` (OpenInference). LLM /
agent calls instrumented with OpenInference automatically appear as child
spans of each test's task span.

## Install

```bash
pnpm add -D @arizeai/phoenix-test vitest dotenv
# or jest:
pnpm add -D @arizeai/phoenix-test jest dotenv
```

## Vitest setup

Create `phoenix.vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["**/*.eval.?(c|m)[jt]s"],
    reporters: ["@arizeai/phoenix-test/vitest/reporter"],
    setupFiles: ["dotenv/config"],
    testTimeout: 30000,
  },
});
```

Add the script:

```json
{ "scripts": { "eval": "vitest run --config phoenix.vitest.config.ts" } }
```

## Jest setup

```js
// phoenix.jest.config.cjs
module.exports = {
  testMatch: ["**/*.eval.?(c|m)[jt]s"],
  reporters: ["default", "@arizeai/phoenix-test/jest/reporter"],
  setupFiles: ["dotenv/config"],
  testTimeout: 30000,
};
```

```json
{ "scripts": { "eval": "jest --config phoenix.jest.config.cjs" } }
```

## Editor integration (VS Code Vitest / Jest extensions)

`px.describe` / `px.test` / `px.it` are thin wrappers around the real
`describe` / `test` / `it` from Vitest or Jest, so the VS Code **Vitest**
and **Jest** extensions discover them automatically — you get the test
tree, the inline ▶ / 🐛 run-and-debug buttons, and `.only` / `.skip`
filtering with no extra configuration. The Phoenix sync (create dataset →
create experiment → post runs → post annotations) runs in `beforeAll` /
`afterAll` lifecycle hooks, so it happens whether the suite is launched
from the editor or the CLI. Running a single test from the gutter still
executes its enclosing `describe`, so the dataset and experiment are
created and you get an experiment containing just that one run.

Two things to know when running from the editor:

- **Register the reporter in config, not just on the CLI.** The
  end-of-run Phoenix summary (output table, annotation scores, dataset /
  experiment links) comes from `@arizeai/phoenix-test/vitest/reporter`
  (or `.../jest/reporter`). The editor extensions run Vitest/Jest with
  their own reporter, so unless the reporter is listed in
  `reporters: [...]` in your config file (as shown above) the summary
  won't print on editor-launched runs. The data still lands in Phoenix
  either way — you just lose the console links. For the full summary, run
  the `eval` script from a terminal.

- **The editor extensions don't load your shell env or `.env`.** The
  `PHOENIX_*` vars (see [Phoenix env vars](#phoenix-env-vars)) must be
  available to the extension's test process. The simplest fix is the
  `setupFiles: ["dotenv/config"]` shown above — it loads `.env` for both
  CLI and editor runs. Otherwise editor-launched runs fail to reach
  Phoenix while terminal runs (which inherit your shell env) succeed,
  which is a confusing way to find out. Alternatively, set the vars
  through the extension settings (`vitest.nodeEnv` / `jest.nodeEnv`).

## Write an eval

```ts
import * as px from "@arizeai/phoenix-test";
// import * as px from "@arizeai/phoenix-test/jest";
import { expect } from "vitest";

px.describe("generate sql demo", () => {
  px.test(
    "generates select all",
    {
      input: { userQuery: "Get all users from the customers table" },
      expected: { sql: "SELECT * FROM customers;" },
    },
    async ({ input, expected }) => {
      const sql = await myApp(input.userQuery);
      px.logOutput({ sql });
      expect(sql).toEqual(expected?.sql);
    }
  );
});
```

The test params line up with the Phoenix `Example` shape:

| Phoenix-test field | Phoenix concept                 |
| ------------------ | ------------------------------- |
| `input`            | `Example.input`                 |
| `expected`         | `Example.output` (reference)    |
| `metadata`         | `Example.metadata`              |
| `id`               | `Example.id` (stable upsert id) |

## Logging annotations

```ts
import * as px from "@arizeai/phoenix-test";

const judge = px.wrapEvaluator(async ({ output, expected }) => {
  // call an LLM-as-judge / @arizeai/phoenix-evals classifier here
  return { name: "correctness", score: 1 };
});

px.describe("demo", () => {
  px.test(
    "case",
    { input: { ... }, expected: { ... } },
    async ({ input, expected }) => {
      const sql = await myApp(input.userQuery);
      px.logOutput({ sql });
      await judge({ output: { sql }, expected });
      px.logAnnotation({
        name: "harmfulness",
        score: 0.2,
        annotatorKind: "CODE",
      });
    },
  );
});
```

`wrapEvaluator()` traces the wrapped call as a separate `EVALUATOR` span
in Phoenix and, if the return value is `{ name, score }`-shaped, files it
as an annotation automatically. The `Annotation` shape mirrors Phoenix's
`ExperimentEvaluationResult`:

```ts
interface Annotation {
  name: string;
  score?: number | boolean | null;
  label?: string | null;
  explanation?: string | null;
  annotatorKind?: "LLM" | "CODE" | "HUMAN"; // defaults to "CODE"
}
```

## test.each

```ts
const DATASET = [
  { input: { userQuery: "whats up" }, expected: { sql: "n/a" } },
  { input: { userQuery: "how are you?" }, expected: { sql: "n/a" } },
];

px.describe("offtopic inputs", () => {
  px.test.each(DATASET)("offtopic input", async ({ input, expected }) => {
    // ...
  });
});
```

## Skipping / focusing tests

```ts
px.describe.only("focused", () => { ... });
px.describe.skip("skipped", () => { ... });
px.test.only("only this one", { input: { ... } }, async () => { ... });
px.test.skip("skip me", { input: { ... } }, async () => { ... });
```

## Suite configuration

```ts
px.describe(
  "suite name",
  () => { ... },
  {
    datasetName: "override-dataset-and-experiment-name",
    description: "what this suite is for",
    metadata: { model: "gpt-4o-mini" },
    client: myCustomPhoenixClient, // overrides createClient()
    repetitions: 3,                // run every test in this suite 3x
    dryRun: true,                  // run locally, don't sync this suite
  },
);
```

## Repetitions

Run a test (or a whole suite) multiple times — useful for measuring
non-determinism. Each repetition becomes a separate experiment run against
the same dataset example, carrying a distinct `repetition_number`, so the
Phoenix compare view shows them side by side.

```ts
px.describe("flaky generation", () => {
  // runs 5 times; suite-level `repetitions` would apply if omitted
  px.test(
    "stays on topic",
    { input: { q: "hi" }, repetitions: 5 },
    async ({ input }) => { ... },
  );
}, { repetitions: 2 });
```

Resolution order: per-test `repetitions` → suite `repetitions` →
`PHOENIX_TEST_REPETITIONS` env var → `1`. With more than one repetition the
underlying runner reports each as `"<name> [rep i/N]"`.

## Dry-run mode

Dry-run executes the test body (and tracing, when a tracer is attached) but
creates **no** dataset, experiment, run, or annotations in Phoenix. The
reporter still prints a local summary.

- **Whole process**: `PHOENIX_TEST_TRACKING=false` or
  `PHOENIX_TEST_DRY_RUN=true` (or just omit the standard Phoenix env vars).
- **One suite**: `px.describe(name, fn, { dryRun: true })`.
- **One test**: `px.test(name, { input, dryRun: true }, fn)` — that case
  runs as an ordinary local test only; no dataset example is created for it
  and nothing about it is uploaded, even when the rest of the suite syncs.

## Security and PII

Every test runs inside an OpenInference span whose `INPUT_VALUE` and
`OUTPUT_VALUE` attributes hold the entire stringified `input` and the
test's return value (or whatever you pass to `logOutput`). Those
attributes are exported to the Phoenix server you configured **and to
any other globally-attached OpenTelemetry tracer** in the test process.
Don't pass real secrets through `input` or return them from a test
body — use redaction or environment variables for credentials.

Configure `PHOENIX_HOST` with `https://` for any non-localhost endpoint.
The package emits a one-time warning when it detects a plain `http://`
URL combined with an `Authorization` header, since that combination
sends the bearer token in cleartext.

## Phoenix env vars

| Env var                                       | Purpose                              |
| --------------------------------------------- | ------------------------------------ |
| `PHOENIX_HOST` / `PHOENIX_COLLECTOR_ENDPOINT` | Phoenix base URL                     |
| `PHOENIX_API_KEY`                             | Bearer token for Phoenix             |
| `PHOENIX_PROJECT_NAME`                        | Override project name for traces     |
| `PHOENIX_TEST_TRACKING=false`                 | Disable sync to Phoenix for this run |
| `PHOENIX_TEST_DRY_RUN=true`                   | Alias of `PHOENIX_TEST_TRACKING=false` |
| `PHOENIX_TEST_REPETITIONS`                    | Default repetition count per test    |

`@arizeai/phoenix-test` reuses the same configuration surface as
`@arizeai/phoenix-client` and `@arizeai/phoenix-otel` — see those READMEs
for the full set of options.

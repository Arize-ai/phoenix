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
  },
);
```

## Dry-run mode

To run tests locally without uploading to Phoenix, set
`PHOENIX_TEST_TRACKING=false` (or omit the standard Phoenix env vars). The
suite runs as ordinary tests, the reporter still prints a local summary,
and no network calls are made.

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

`@arizeai/phoenix-test` reuses the same configuration surface as
`@arizeai/phoenix-client` and `@arizeai/phoenix-otel` — see those READMEs
for the full set of options.

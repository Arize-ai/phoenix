# phoenix-client-test-quickstart

A fully-runnable example set for the `@arizeai/phoenix-client/vitest` and
`@arizeai/phoenix-client/jest` submodules. These examples run dataset-backed
evaluations as **Vitest** or **Jest** tests, syncing inputs, outputs, and
annotations to [Arize Phoenix](https://docs.arize.com/phoenix).

Every example here runs **offline with no API keys and no Phoenix server** by
default, so you can see the whole surface working in seconds, then point it at a
real Phoenix instance when you're ready.

## How it maps to Phoenix

| In your test            | In Phoenix                                  |
| ----------------------- | ------------------------------------------- |
| `px.describe(...)`      | a **dataset** + a new **experiment**        |
| `px.test(name, params)` | a dataset **example** + an experiment **run** |
| `params.input`          | `Example.input`                             |
| `params.expected`       | `Example.output` (reference)                |
| each `expect(...)`      | a `pass` annotation on the run              |
| `px.recordOutput(...)`     | the run's actual output                     |
| `px.traceEvaluator` / `px.logAnnotation` | annotations on the run      |

## Run it

```bash
# from the monorepo's js/ directory
pnpm install

cd examples/apps/phoenix-client-test-quickstart

pnpm eval          # Vitest examples, offline (PHOENIX_TEST_TRACKING=false)
pnpm eval:jest     # the Jest variant, offline
pnpm typecheck     # type-check everything
```

Run a single file (or filter), e.g.:

```bash
pnpm eval evals/02-annotations.eval.ts
```

## Sync to a real Phoenix

1. Start Phoenix (e.g. `docker run -p 6006:6006 arizephoenix/phoenix`).
2. `cp .env.example .env` and set `PHOENIX_HOST` (and `PHOENIX_API_KEY` if your
   instance needs auth).
3. Run the tracking variant — same tests, but they create datasets, experiments,
   runs, and annotations, and the reporter prints links:

   ```bash
   pnpm eval:phoenix         # Vitest, syncing to Phoenix
   pnpm eval:jest:phoenix    # Jest, syncing to Phoenix
   pnpm eval:watch:phoenix   # Vitest watch, syncing to Phoenix
   ```

## What each example shows

| File                                  | Demonstrates                                            |
| ------------------------------------- | ------------------------------------------------------- |
| `evals/01-basics.eval.ts`             | `describe` / `test`, `input` / `expected`, `recordOutput`, assertions |
| `evals/02-annotations.eval.ts`        | `traceEvaluator` (auto-annotation) and `logAnnotation`   |
| `evals/03-test-each.eval.ts`          | data-driven evals with `test.each`                      |
| `evals/04-repetitions.eval.ts`        | per-test and suite-level `repetitions`                  |
| `evals/05-suite-config.eval.ts`       | `datasetName` / `description` / `metadata`, per-test tags |
| `evals/06-skip-focus-dryrun.eval.ts`  | `.skip`, `.only`, and per-test `dryRun`                 |
| `evals/07-llm-openai.eval.ts`         | the production shape: a live OpenAI call + LLM-as-a-judge (skipped unless `OPENAI_API_KEY` is set) |
| `evals/08-four-tests.eval.ts`         | four explicit `px.test` cases under one `px.describe`   |
| `jest/basics.eval.ts`                 | the same patterns under Jest (`@arizeai/phoenix-client/jest`) |

`src/app.ts` is a deterministic, rule-based stand-in for the "app under test"
(a toy text-to-SQL feature) so the examples stay hermetic. Swap it for your real
LLM/agent call — `evals/07-llm-openai.eval.ts` shows exactly that.

## Notes

- **Offline mode** (`PHOENIX_TEST_TRACKING=false`) still runs every test body
  and assertion; it just skips the network sync. The reporter prints a local
  summary.
- **Editor integration**: `px.describe` / `px.test` wrap the real Vitest/Jest
  functions, so the VS Code Vitest and Jest extensions discover them (test tree,
  inline ▶ / 🐛 buttons, `.only` / `.skip`). The `setupFiles: ["dotenv/config"]`
  in both configs loads `.env` for editor-launched runs too.
- **The Vitest and Jest files are separated by folder** (`evals/` vs `jest/`) so
  each runner only picks up the files written against its own import path.

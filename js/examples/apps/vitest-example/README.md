# vitest-example

A fully-runnable example set for the `@arizeai/phoenix-client/vitest` submodule.
These examples run dataset-backed evaluations as **Vitest** tests, syncing
inputs, outputs, and annotations to [Arize Phoenix](https://docs.arize.com/phoenix).

Every example here runs **offline with no API keys and no Phoenix server** by
default, so you can see the whole surface working in seconds, then point it at a
real Phoenix instance when you're ready.

> Prefer Jest? The package ships a matching `@arizeai/phoenix-client/jest`
> entrypoint with the identical API — see the package's `ci-evals-jest` doc.

## How it maps to Phoenix

| In your test                            | In Phoenix                                    |
| --------------------------------------- | --------------------------------------------- |
| `px.describe(...)`                      | a **dataset** + a new **experiment**          |
| `px.test(name, params)`                 | a dataset **example** + an experiment **run** |
| `params.input`                          | `Example.input`                               |
| `params.expected`                       | `Example.output` (reference)                  |
| each `expect(...)`                      | a `pass` annotation on the run                |
| `px.logOutput(...)`                     | the run's actual output                       |
| `px.evaluate(...)` / `px.logAnnotation` | annotations on the run                        |

## Run it

```bash
# from the monorepo's js/ directory
pnpm install

cd examples/apps/vitest-example

pnpm eval          # all examples, offline (PHOENIX_TEST_TRACKING=false)
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
   pnpm eval:phoenix         # syncing to Phoenix
   pnpm eval:watch:phoenix   # watch mode, syncing to Phoenix
   ```

## Guardrails vs. graded scores

The examples model the two jobs an eval suite does at once, and it's worth
understanding the split:

- **Guardrails** are hard invariants asserted with `expect(...)`. A failed
  assertion fails the test (and CI) and flips the run's `pass` annotation to 0.
  Here the guardrail is "valid SQL for a data question, a refusal for anything
  off-topic" — something the app must _never_ get wrong.
- **Graded scores** are annotations from `px.evaluate` (`exact_match`,
  `token_f1`, `valid_sql`, `correct_table`). They measure _quality_ and don't
  fail individual tests, so the Phoenix experiment captures the real spread.
  Add `acceptanceCriteria` on `px.describe` when a metric should fail CI only
  after it misses an aggregate bar, such as average `token_f1 < 0.8`.

That's why the suite passes even though the app is deliberately imperfect: the
harder cases (a boolean flag, a two-condition filter) keep their guardrails but
score below 1.0 on `exact_match` and `token_f1`. A flat 100% on every metric
usually means your eval set is too easy — not that your app is flawless.

## What each example shows

| File                                 | Demonstrates                                                                                       |
| ------------------------------------ | -------------------------------------------------------------------------------------------------- |
| `evals/01-basics.eval.ts`            | `describe` / `test`, `input` / `expected`, `logOutput`, assertions                                 |
| `evals/02-annotations.eval.ts`       | evaluator annotations via `px.evaluate` + `logAnnotation` on a case the app partly misses          |
| `evals/03-test-each.eval.ts`         | running the full curated dataset with `test.each` and graded metrics                               |
| `evals/04-repetitions.eval.ts`       | per-test and suite-level `repetitions`                                                             |
| `evals/05-suite-config.eval.ts`      | `datasetName` / `description` / `metadata`, per-test tags                                          |
| `evals/06-skip-focus-dryrun.eval.ts` | `.skip`, `.only`, and per-test `dryRun`                                                            |
| `evals/07-llm-openai.eval.ts`        | the production shape: a live OpenAI call + LLM-as-a-judge (skipped unless `OPENAI_API_KEY` is set) |
| `evals/08-quality-scorecard.eval.ts` | the full evaluator panel across cases of mixed difficulty, with suite-level acceptance criteria    |

Supporting modules:

- `src/app.ts` — the deterministic text-to-SQL "app under test". It's good but
  intentionally imperfect, so the graded metrics have something real to measure.
  Swap it for your own LLM/agent call — `evals/07-llm-openai.eval.ts` shows how.
- `src/dataset.ts` — the curated eval set (`TEXT_TO_SQL_CASES`) shared by the
  data-driven suites, with a difficulty + skill on every case.
- `src/evaluators.ts` — reusable evaluator scorers (exact match, token
  F1, SQL validity, correct table).

## Notes

- **Offline mode** (`PHOENIX_TEST_TRACKING=false`) still runs every test body
  and assertion; it just skips the network sync. The reporter prints a local
  summary.
- **Editor integration**: `px.describe` / `px.test` wrap the real Vitest
  functions, so the VS Code Vitest extension discovers them (test tree, inline
  ▶ / 🐛 buttons, `.only` / `.skip`). The `setupFiles: ["dotenv/config"]` in the
  config loads `.env` for editor-launched runs too.

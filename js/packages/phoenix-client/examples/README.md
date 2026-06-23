# Running phoenix-client Examples

To run the TypeScript examples in this directory, you need to have `tsx` installed globally. `tsx` allows you to run TypeScript files directly without compiling them first.

## Install tsx globally

```sh
pnpm install tsx -g
```

## Run an example

You can run any example TypeScript file using `tsx` like this:

```sh
tsx <example-file>.ts
```

For example, to run `run_experiment.ts`:

```sh
tsx run_experiment.ts
```

## Run the eval-test examples

The vitest examples live in [`vitest/`](./vitest) and use the
`@arizeai/phoenix-client/vitest` submodule with the
`vitest/phoenix.vitest.config.ts` config.

- `01-basics` … `08-acceptance-scorecard` — a numbered tour of the full API
  (annotations, `test.each`, repetitions, skip / dry-run / focus, reference-key
  aliases, and acceptance criteria with `direction`). These run **fully offline**
  against a deterministic stand-in app (`app.ts` / `evaluators.ts`) — no API keys.
- `sql.eval.ts` — the same flow backed by a real OpenAI call when `OPENAI_API_KEY`
  is set (otherwise it falls back to the offline stand-in).

Run the whole suite locally without syncing anything to Phoenix:

```sh
cd js/packages/phoenix-client
PHOENIX_TEST_TRACING=false pnpm exec vitest run \
  --config examples/vitest/phoenix.vitest.config.ts
```

To track results to a Phoenix server, drop `PHOENIX_TEST_TRACING=false` and set
`PHOENIX_HOST` / `PHOENIX_API_KEY`. Run a single file by appending its path
(e.g. `examples/vitest/01-basics.eval.ts`). Run from the package root so
`pnpm exec` can resolve the workspace package and dependencies.

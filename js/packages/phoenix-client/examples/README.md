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

## Run the eval-test example

The vitest example lives in [`vitest/`](./vitest). `vitest/sql.eval.ts` uses
the `@arizeai/phoenix-client/vitest` submodule and is run with Vitest, using the
`vitest/phoenix.vitest.config.ts` config:

```sh
cd js/packages/phoenix-client
OPENAI_API_KEY= PHOENIX_TEST_TRACKING=false pnpm exec vitest run \
  --config examples/vitest/phoenix.vitest.config.ts examples/vitest/sql.eval.ts
```

Run from the package root so `pnpm exec` can resolve the workspace package and
dependencies.

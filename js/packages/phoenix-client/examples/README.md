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

`sql.eval.ts` uses the `@arizeai/phoenix-client/vitest` submodule and
should be run with Vitest:

```sh
pnpm exec vitest run --config phoenix.vitest.config.ts sql.eval.ts
```

Make sure you are in the `examples` directory when running the command, or provide the correct relative path to the example file.

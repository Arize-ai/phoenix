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

Make sure you are in the `examples` directory when running the command, or provide the correct relative path to the example file.

## Upsert + Experiment Iteration Example

The `upsert_dataset_experiments.ts` example demonstrates an end-to-end iteration loop:

1. upsert initial dataset examples
2. run an experiment
3. evolve the dataset via upsert
4. run another experiment on the updated dataset version

Smoke run (no Phoenix server required):

```sh
tsx upsert_dataset_experiments.ts --smoke-run
```

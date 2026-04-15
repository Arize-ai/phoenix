# Phoenix App Evals

Experiment scripts that exercise the PXI agent system prompt against a running Phoenix instance. Each `*.eval.ts` file is a standalone script that creates a dataset and runs an experiment via `@arizeai/phoenix-client`.

## Prerequisites

- A running Phoenix instance (local or remote).
- `ANTHROPIC_API_KEY` exported in your shell.
- `PHOENIX_HOST` pointing at your Phoenix instance (defaults to `http://localhost:6006`).
- `PHOENIX_API_KEY` if your Phoenix instance has auth enabled.

## Running an eval

From the `app/` directory, run any eval file directly with [`tsx`](https://tsx.is):

```bash
pnpm dlx tsx evals/documentation.eval.ts
```

`pnpm dlx` fetches `tsx` on demand so you do not need to add it as a dependency.

## Example

```bash
export ANTHROPIC_API_KEY=sk-ant-...
export PHOENIX_HOST=http://localhost:6006
pnpm dlx tsx evals/documentation.eval.ts
```

The script prints the experiment URL on completion. Inspect results in the Phoenix UI under the dataset the eval creates, or via the Phoenix CLI:

```bash
npx @arizeai/phoenix-cli experiment list --dataset phoenix-documentation-questions
```

## Adding a new eval

1. Create `evals/<name>.eval.ts` following the structure of `documentation.eval.ts`.
2. Use `createOrGetDataset` so the dataset is idempotent across runs.
3. Register any evaluators via `asExperimentEvaluator` and pass them to `runExperiment`.
4. Run the script with `pnpm dlx tsx evals/<name>.eval.ts`.

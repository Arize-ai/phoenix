# Eval-library benchmarks

Vitest suites for Phoenix built-in classification evaluators, plus a **sweep** CLI that runs one Phoenix experiment per `model × prompt × format` cell.

## Sweep

Each cell is one Vitest process. The child process reads:

| Env var | Axis | Default |
| --- | --- | --- |
| `EVAL_MODEL` | Judge model | `gpt-4o-mini` |
| `EVAL_PROMPT_TECHNIQUE` | Prompt technique | `default` (library template) |
| `EVAL_DATA_FORMAT` | Example encoding | `default` (XML `<data>` fields) |

From the JS workspace:

```bash
cd js
pnpm --filter evals-benchmarks sweep -- --evaluator <id> [options]
```

After a workspace install, from this directory:

```bash
pnpm sweep -- --evaluator <id> [options]
```

`--evaluator` is the eval filename without `.eval.ts` (`toxicity`, `hallucination`, `correctness`, …).

```bash
pnpm --filter evals-benchmarks sweep -- --evaluator hallucination --formats default,json,messages
pnpm --filter evals-benchmarks sweep -- --evaluator toxicity --models gpt-4o-mini,gpt-4o
pnpm --filter evals-benchmarks sweep -- --evaluator toxicity --prompts default,few-shot
```

Unit tests for the CLI (no LLM calls):

```bash
pnpm --filter evals-benchmarks test:cli
```

## Axes

### Models

`--models` is a comma-separated list. Tokens are parsed in `src/resolveEvalModel.ts` (`provider:modelId`, or heuristics for `claude*` / `gemini*`). Every eval file uses `bindSweepEvaluator`, which constructs the judge from `EVAL_MODEL`. Adding a provider belongs in `resolveEvalModel.ts`, not in each eval.

### Formats

`--formats` may be `default`, `json`, and/or `messages`. Implementation: `src/formats/applyDataFormat.ts`, applied inside `bindSweepEvaluator`.

To add a format:

1. Add the id to `UNIVERSAL_DATA_FORMATS` in `src/cli/config.ts`.
2. Handle it in `applyDataFormat`.
3. Add tests in `src/formats/applyDataFormat.test.ts`.

No eval-file changes; every suite already goes through the helper.

### Prompt techniques

`--prompts` defaults to `default` (the library template from phoenix-evals). Extra techniques are **per evaluator**. Today only toxicity implements `few-shot` (`src/prompts/toxicity.ts`).

To add a technique for an evaluator:

1. Put the template in `src/prompts/<evaluator>.ts` (export a resolver that returns `undefined` for `default` and a `PromptTemplate` for the new id).
2. Register it in `src/prompts/index.ts` (`resolvePromptTemplate`).
3. Add the id to `EXTRA_PROMPT_TECHNIQUES` in `src/cli/config.ts` so the CLI accepts `--prompts <id>`.
4. Add tests next to the prompt module.

Eval files that already call `bindSweepEvaluator` do not need to change.

## New evaluator

1. Add `src/<id>.eval.ts` that uses `bindSweepEvaluator` with `evaluatorId: "<id>"` and the matching `createXEvaluator`.
2. Sweep discovers it from the filename. Register extra prompt techniques only if you add them.

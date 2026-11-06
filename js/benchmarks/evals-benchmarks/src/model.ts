/**
 * The judge model shared by every benchmark suite.
 *
 * Override via the `EVAL_MODEL` env var to benchmark the evaluators on a
 * different model, e.g. `EVAL_MODEL=gpt-4o pnpm run evals:local`.
 */
import { openai } from "@ai-sdk/openai";

export const DEFAULT_EVAL_MODEL = "gpt-4o-mini";

export const evalModelName = process.env.EVAL_MODEL ?? DEFAULT_EVAL_MODEL;

export const evalModel = openai(evalModelName);

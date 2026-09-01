/**
 * The judge model shared by every benchmark suite.
 *
 * Override via the `EVAL_MODEL` env var to benchmark the evaluators on a
 * different model, e.g. `EVAL_MODEL=gpt-4o pnpm run evals:local`.
 *
 * Provider is chosen by {@link createEvalModel}: optional `provider:modelId`
 * prefix, else heuristics (`claude*` → Anthropic, `gemini*`/`gemma*` → Google,
 * otherwise OpenAI).
 */
import { createEvalModel, DEFAULT_EVAL_MODEL } from "./resolveEvalModel.js";

export { DEFAULT_EVAL_MODEL };

export const evalModelName = process.env.EVAL_MODEL ?? DEFAULT_EVAL_MODEL;

export const evalModel = createEvalModel(evalModelName);

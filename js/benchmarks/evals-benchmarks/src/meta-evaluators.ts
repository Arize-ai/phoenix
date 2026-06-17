/**
 * Shared infrastructure for the evaluator benchmarks.
 *
 * Each benchmark is a *meta-evaluation*: it feeds pre-labeled examples to one
 * of the built-in `@arizeai/phoenix-evals` evaluators and measures how often
 * that evaluator's predicted `label` matches the known-correct label. The
 * evaluator under test is the "task"; the `labelAccuracy` evaluator below is the
 * annotation that actually scores the benchmark.
 */
import type { Evaluator, SuiteConfig } from "@arizeai/phoenix-client/vitest";

/**
 * Every benchmark calls a live LLM (via the evaluator under test), so the
 * suites are skipped unless an OpenAI key is present — exactly like
 * `evals/07-llm-openai.eval.ts` in the vitest-example app.
 */
export const HAS_OPENAI = Boolean(process.env.OPENAI_API_KEY);

/** The classification shape returned by the built-in evaluators. */
export interface EvaluatorPrediction {
  label?: string | null;
  score?: number | null;
  explanation?: string | null;
}

/** The reference shape carried on each benchmark example's `expected`. */
export interface ExpectedLabel {
  label: string;
}

/**
 * Meta-evaluator: scores whether the evaluator-under-test's predicted `label`
 * matches the expected label on the dataset example. Reads the recorded run
 * output and the example's `expected` by default, so a benchmark only needs to
 * `recordOutput(prediction)` and then `await evaluate(labelAccuracy)`.
 */
export const labelAccuracy: Evaluator = {
  name: "accuracy",
  kind: "CODE",
  evaluate: ({ output, expected }) => {
    const predicted =
      (output as EvaluatorPrediction | undefined)?.label ?? null;
    const want = (expected as ExpectedLabel | undefined)?.label ?? null;
    const match = predicted != null && predicted === want;
    return {
      score: match ? 1 : 0,
      label: match ? "accurate" : "inaccurate",
      explanation: `Evaluator predicted "${predicted}", expected "${want}".`,
    };
  },
};

/** A callable suite declaration (`describe` or `describe.skip`). */
type SuiteFn = (name: string, fn: () => void, config?: SuiteConfig) => void;

/** Gate a suite behind OPENAI_API_KEY: returns `describe` or `describe.skip`. */
export function benchmarkSuite(describe: {
  (name: string, fn: () => void, config?: SuiteConfig): void;
  skip: SuiteFn;
}): SuiteFn {
  return HAS_OPENAI ? describe : describe.skip;
}

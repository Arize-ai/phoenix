/**
 * Reusable, code-based evaluators built with `px.wrapEvaluator`.
 *
 * `wrapEvaluator` does two things:
 *   1. Traces the wrapped call as its own `EVALUATOR` span in Phoenix.
 *   2. If the return value is `{ name, score }`-shaped, files it as an
 *      annotation on the current run automatically — no `logAnnotation` needed.
 *
 * These are deterministic (string comparisons) so the examples stay offline.
 * An LLM-as-a-judge would have the exact same shape — just `await` a model
 * call inside the wrapped function (see `evals/07-llm-openai.eval.ts`).
 */
import * as px from "@arizeai/phoenix-client/vitest";

/** Normalize SQL for comparison: collapse whitespace, drop case + trailing `;`. */
function normalizeSql(sql: string): string {
  return sql
    .trim()
    .replace(/\s+/g, " ")
    .replace(/;$/, "")
    .toLowerCase();
}

/**
 * Exact-match (after light normalization). Returns a boolean score, which
 * Phoenix records as 1 / 0.
 */
export const exactMatch = px.wrapEvaluator(
  async ({ output, expected }: { output: string; expected: string }) => ({
    name: "exact_match",
    score: normalizeSql(output) === normalizeSql(expected),
  }),
  { name: "exact_match" }
);

/**
 * Demonstrates a richer annotation: a numeric score plus a `label` and
 * `explanation`, which show up as separate columns in the Phoenix compare view.
 */
export const containsSelect = px.wrapEvaluator(
  async ({ output }: { output: string }) => {
    const ok = /\bselect\b/i.test(output);
    return {
      name: "is_valid_sql",
      score: ok ? 1 : 0,
      label: ok ? "valid" : "invalid",
      explanation: ok
        ? "Output contains a SELECT statement."
        : "Output is missing a SELECT statement.",
    };
  },
  { name: "is_valid_sql" }
);

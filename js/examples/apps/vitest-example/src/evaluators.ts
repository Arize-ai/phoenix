/**
 * Reusable, code-based evaluators built with `px.traceEvaluator`.
 *
 * `traceEvaluator` does two things:
 *   1. Traces the evaluator call as its own `EVALUATOR` span in Phoenix.
 *   2. If the return value is `{ name, score }`-shaped, files it as an
 *      annotation on the current run automatically — no `logAnnotation` needed.
 *
 * These are deterministic string/structure checks so the examples stay offline,
 * but they're written the way you'd actually score text-to-SQL: a strict exact
 * match, a softer token-overlap score for partial credit, a syntactic validity
 * check, and a "did it query the right table" check. Together they produce a
 * realistic *spread* of scores rather than a single pass/fail. An LLM-as-a-judge
 * has the same shape — just `await` a model call inside the traced function
 * (see `evals/07-llm-openai.eval.ts`).
 */
import * as px from "@arizeai/phoenix-client/vitest";

/** Collapse whitespace, drop the trailing `;`, and lowercase for comparison. */
function normalizeSql(sql: string): string {
  return sql.trim().replace(/\s+/g, " ").replace(/;$/, "").toLowerCase();
}

/** Split SQL into comparable tokens (keywords, identifiers, numbers, `*`). */
function tokenize(sql: string): string[] {
  return normalizeSql(sql)
    .split(/[^a-z0-9*]+/)
    .filter(Boolean);
}

/** The table named in a query's first `FROM`, if any. */
function tableOf(sql: string): string | null {
  return normalizeSql(sql).match(/\bfrom\s+(\w+)/)?.[1] ?? null;
}

/**
 * Strict correctness: exact match after light normalization. Boolean scores are
 * recorded by Phoenix as 1 / 0. This is the metric most queries either fully
 * pass or fully fail.
 */
export const sqlExactMatch = px.traceEvaluator(
  async ({ output, expected }: { output: string; expected: string }) => {
    const match = normalizeSql(output) === normalizeSql(expected);
    return {
      name: "exact_match",
      score: match,
      explanation: match
        ? "Output matches the reference SQL."
        : "Output differs from the reference SQL.",
    };
  },
  { name: "exact_match" }
);

/**
 * Partial credit: token-overlap F1 between the output and the reference SQL,
 * rounded to two decimals. A near-miss (right table and shape, wrong filter)
 * lands around 0.7–0.9 instead of a flat 0, which is what makes an eval
 * dashboard actually useful for spotting "almost right" regressions.
 */
export const sqlSimilarity = px.traceEvaluator(
  async ({ output, expected }: { output: string; expected: string }) => {
    const out = new Set(tokenize(output));
    const ref = new Set(tokenize(expected));
    const overlap = [...out].filter((token) => ref.has(token)).length;
    const precision = out.size ? overlap / out.size : 0;
    const recall = ref.size ? overlap / ref.size : 0;
    const f1 =
      precision + recall === 0
        ? 0
        : (2 * precision * recall) / (precision + recall);
    return {
      name: "token_f1",
      score: Math.round(f1 * 100) / 100,
      explanation: `Token overlap F1 between output and reference (${overlap} shared tokens).`,
    };
  },
  { name: "token_f1" }
);

/**
 * Guardrail: is the output syntactically a well-formed `SELECT`? Returns a
 * `valid` / `invalid` label alongside the score so you can filter on it in the
 * Phoenix UI. This is the kind of invariant worth asserting on hard in a test.
 */
export const isValidSql = px.traceEvaluator(
  async ({ output }: { output: string }) => {
    const sql = normalizeSql(output);
    const opens = (sql.match(/\(/g) ?? []).length;
    const closes = (sql.match(/\)/g) ?? []).length;
    const valid =
      /^select\b/.test(sql) && /\bfrom\b/.test(sql) && opens === closes;
    return {
      name: "valid_sql",
      score: valid ? 1 : 0,
      label: valid ? "valid" : "invalid",
      explanation: valid
        ? "Output is a well-formed SELECT statement."
        : "Output is not a well-formed SELECT statement.",
    };
  },
  { name: "valid_sql" }
);

/**
 * Did the query hit the right table? A cheap, high-signal check: a model can
 * write valid SQL against entirely the wrong table, and this catches it without
 * needing the full statement to match.
 */
export const targetsExpectedTable = px.traceEvaluator(
  async ({ output, expected }: { output: string; expected: string }) => {
    const want = tableOf(expected);
    const got = tableOf(output);
    const match = want !== null && want === got;
    return {
      name: "correct_table",
      score: match,
      label: got ?? "none",
      explanation:
        want === null
          ? "Reference has no table (off-topic case)."
          : `Expected table ${want}, output queried ${got ?? "none"}.`,
    };
  },
  { name: "correct_table" }
);

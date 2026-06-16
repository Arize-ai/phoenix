/**
 * 02 — Annotations (evaluators + manual scores).
 *
 * Two ways to attach scores to a run:
 *   - `px.traceEvaluator(fn)` — runs `fn` as a traced EVALUATOR span and, when
 *     it returns `{ name, score }`, files the annotation automatically.
 *   - `px.logAnnotation({ ... })` — record a score you computed inline.
 *
 * This case is one the app gets *partly* wrong: "show active users" returns the
 * right table but drops the `WHERE active = TRUE` filter. That's exactly when
 * graded annotations earn their keep — `exact_match` is 0, but `token_f1` lands
 * around 0.7 and `valid_sql` / `correct_table` stay green. The test itself only
 * asserts the hard guardrail (valid SQL), so the suite passes while the
 * annotations capture the nuance for the Phoenix dashboard.
 *
 * Run offline:
 *   pnpm eval evals/02-annotations.eval.ts
 */
import * as px from "@arizeai/phoenix-client/vitest";
import { expect } from "vitest";

import { generateSql, isOnTopic } from "../src/app";
import {
  isValidSql,
  sqlExactMatch,
  sqlSimilarity,
  targetsExpectedTable,
} from "../src/evaluators";

px.describe("text-to-sql: annotations", () => {
  px.test(
    "grades a near-miss with several evaluators",
    {
      input: { userQuery: "Show active users" },
      expected: { sql: "SELECT * FROM users WHERE active = TRUE;" },
    },
    async ({ input, expected }) => {
      const { sql } = generateSql(input.userQuery);
      px.recordOutput({ sql });

      const reference = expected?.sql ?? "";
      // Each evaluator lands as its own annotation on the run. Together they
      // tell the story: right table, valid SQL, but not an exact match.
      await sqlExactMatch({ output: sql, expected: reference });
      await sqlSimilarity({ output: sql, expected: reference });
      await isValidSql({ output: sql });
      await targetsExpectedTable({ output: sql, expected: reference });

      // A manual, inline annotation. `annotatorKind` defaults to "CODE".
      px.logAnnotation({
        name: "on_topic",
        score: isOnTopic(input.userQuery),
        annotatorKind: "CODE",
        explanation: "Whether the query maps to a known table.",
      });

      // Guardrail only: the app must always emit valid, on-table SQL — even
      // when it misses the exact filter. We don't assert exact equality here.
      expect(sql).toContain("SELECT");
      expect(sql).toContain("FROM users");
    }
  );
});

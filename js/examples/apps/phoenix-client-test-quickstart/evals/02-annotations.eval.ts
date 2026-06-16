/**
 * 02 — Annotations (evaluators + manual scores).
 *
 * Two ways to attach scores to a run:
 *   - `px.wrapEvaluator(fn)` — runs `fn` as a traced EVALUATOR span and, when
 *     it returns `{ name, score }`, files the annotation automatically.
 *   - `px.logAnnotation({ ... })` — record a score you computed inline.
 *
 * Run offline:
 *   pnpm eval evals/02-annotations.eval.ts
 */
import * as px from "@arizeai/phoenix-client/vitest";
import { expect } from "vitest";

import { generateSql, isOnTopic } from "../src/app";
import { containsSelect, exactMatch } from "../src/evaluators";

px.describe("text-to-sql: annotations", () => {
  px.test(
    "scores correctness and validity",
    {
      input: { userQuery: "show every product in the products table" },
      expected: { sql: "SELECT * FROM products;" },
    },
    async ({ input, expected }) => {
      const { sql } = generateSql(input.userQuery);
      px.logOutput({ sql });

      // Reusable evaluators — each lands as its own annotation on the run.
      await exactMatch({ output: sql, expected: expected?.sql ?? "" });
      await containsSelect({ output: sql });

      // A manual, inline annotation. `annotatorKind` defaults to "CODE".
      px.logAnnotation({
        name: "on_topic",
        score: isOnTopic(input.userQuery),
        annotatorKind: "CODE",
        explanation: "Whether the query maps to a known table.",
      });

      expect(sql).toContain("SELECT");
    }
  );
});

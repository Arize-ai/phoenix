/**
 * 02 · Annotations — record evaluator scores and manual annotations on a run.
 *
 * `evaluate()` records the evaluator's result as an annotation automatically;
 * `logAnnotation()` lets you attach your own (numeric score, label-only, etc.)
 * with an optional `annotatorKind` of "CODE", "LLM", or "HUMAN".
 */
import * as px from "@arizeai/phoenix-client/vitest";

import { generateSql } from "./app";
import { correctness, tokenF1, validSql } from "./evaluators";

px.describe("02 · annotations", () => {
  px.test(
    "annotates a run several ways",
    {
      input: { userQuery: "show me all orders" },
      expected: { sql: "SELECT * FROM orders;" },
    },

    async ({ input }) => {
      // Measure the real wall-clock time of the call we're evaluating.
      const start = performance.now();
      const output = generateSql(input);
      const latencyMs = performance.now() - start;
      px.logOutput(output);

      // Evaluator-produced annotations: boolean, graded, and structural.
      await px.evaluate(correctness);
      await px.evaluate(tokenF1);
      await px.evaluate(validSql);

      // A manual numeric annotation with an explanation.
      px.logAnnotation({
        name: "latency_ms",
        score: latencyMs,
        annotatorKind: "CODE",
        explanation: "Wall-clock time to generate the SQL.",
      });

      // A manual label-only annotation (e.g. a human rubric tag).
      px.logAnnotation({
        name: "review",
        label: "looks-good",
        annotatorKind: "HUMAN",
      });
    }
  );
});

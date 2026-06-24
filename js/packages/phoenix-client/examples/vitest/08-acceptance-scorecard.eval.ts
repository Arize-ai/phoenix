/**
 * 08 · Acceptance criteria — gate the suite on aggregate scores in CI.
 *
 * `metric` decides how scores are aggregated and gated:
 *   - "average" — the mean score across runs must clear `threshold`
 *     (`direction: "minimize"` flips the comparison for lower-is-better metrics).
 *   - "passRate" — each run passes when `passFn` returns true for its
 *     annotation; the suite passes when the fraction of passing runs is at
 *     least `threshold`.
 *
 * Criteria run after every case, so the reporter prints the full scorecard
 * before failing CI on a miss.
 */
import * as px from "@arizeai/phoenix-client/vitest";

import { generateSql } from "./app";
import { correctness, tokenF1, validSql } from "./evaluators";

px.describe(
  "08 · acceptance scorecard",
  () => {
    px.test.each([
      {
        input: { userQuery: "all customers" },
        expected: { sql: "SELECT * FROM customers;" },
      },
      {
        input: { userQuery: "all orders" },
        expected: { sql: "SELECT * FROM orders;" },
      },
      {
        input: { userQuery: "count the users" },
        expected: { sql: "SELECT COUNT(*) FROM users;" },
      },
    ])("text-to-sql %s", async ({ input }) => {
      const start = performance.now();
      const output = generateSql(input);
      const latencyMs = performance.now() - start;
      px.logOutput(output);
      await px.evaluate(correctness);
      await px.evaluate(tokenF1);
      await px.evaluate(validSql);
      px.logAnnotation({
        name: "latency_ms",
        score: latencyMs,
        annotatorKind: "CODE",
      });
    });
  },
  {
    acceptanceCriteria: [
      // graded: the mean token_f1 across the suite must be >= 0.8
      { annotationName: "token_f1", metric: "average", threshold: 0.8 },
      // consistency: at least 90% of runs must score >= 0.7 on token_f1
      {
        annotationName: "token_f1",
        metric: "passRate",
        passFn: (a) => typeof a.score === "number" && a.score >= 0.7,
        threshold: 0.9,
      },
      // hard floor: every run must produce valid SQL (boolean must be true)
      {
        annotationName: "valid_sql",
        metric: "passRate",
        passFn: (a) => a.score === true,
        threshold: 1,
      },
      // lower-is-better: the mean latency must stay at or below 200ms
      {
        annotationName: "latency_ms",
        metric: "average",
        threshold: 200,
        direction: "minimize",
      },
    ],
  }
);

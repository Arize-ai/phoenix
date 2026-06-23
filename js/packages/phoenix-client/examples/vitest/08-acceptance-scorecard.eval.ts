/**
 * 08 · Acceptance criteria — gate the suite on aggregate scores in CI.
 *
 * Every criterion has a `threshold`; `metric` decides how it applies:
 *   - "average"  — the mean score across runs must clear the threshold.
 *   - "passRate" — every run must clear the threshold (booleans pass on `true`).
 * `direction: "minimize"` flips the comparison for lower-is-better metrics.
 *
 * Criteria run after every case, so the reporter prints the full scorecard
 * before failing CI on a miss.
 */
import * as px from "@arizeai/phoenix-client/vitest";

import { estimateLatencyMs, generateSql } from "./app";
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
      px.logOutput(generateSql(input));
      await px.evaluate(correctness);
      await px.evaluate(tokenF1);
      await px.evaluate(validSql);
      px.logAnnotation({
        name: "latency_ms",
        score: estimateLatencyMs(input),
        annotatorKind: "CODE",
      });
    });
  },
  {
    acceptanceCriteria: [
      // graded: the mean token_f1 across the suite must be >= 0.8
      { annotationName: "token_f1", metric: "average", threshold: 0.8 },
      // strict: every run must pass valid_sql (boolean → must be true)
      { annotationName: "valid_sql", metric: "passRate", threshold: 1 },
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

/**
 * 08 — A multi-metric quality scorecard.
 *
 * Where `test.each` (03) runs the whole set with two metrics, this suite uses a
 * few explicit, well-named cases and runs the *full* evaluator panel on each —
 * `exact_match`, `token_f1`, `valid_sql`, and `correct_table`. That's how you'd
 * build a scorecard for a feature you care about: pick representative cases
 * across difficulties and watch several metrics at once.
 *
 * Read the reporter output as a scorecard: `valid_sql` and `correct_table`
 * should stay at 1.0 (those are guardrails), while `exact_match` and `token_f1`
 * dip on the harder cases — that gap is your model's real headroom.
 *
 * Run offline:
 *   pnpm eval evals/08-quality-scorecard.eval.ts
 */
import * as px from "@arizeai/phoenix-client/vitest";
import { expect } from "vitest";

import { generateSql } from "../src/app";
import {
  isValidSql,
  sqlExactMatch,
  sqlSimilarity,
  targetsExpectedTable,
} from "../src/evaluators";

/** Run the full evaluator panel and assert the universal guardrail. */
async function score(userQuery: string, referenceSql: string): Promise<void> {
  const { sql } = generateSql(userQuery);
  px.recordOutput({ sql });
  await px.evaluate(sqlExactMatch, { output: sql, expected: referenceSql });
  await px.evaluate(sqlSimilarity, { output: sql, expected: referenceSql });
  await px.evaluate(isValidSql, { output: sql });
  await px.evaluate(targetsExpectedTable, {
    output: sql,
    expected: referenceSql,
  });
  // Guardrail: always valid SQL for these on-topic cases.
  expect(sql).toMatch(/^SELECT/i);
}

px.describe(
  "text-to-sql: quality scorecard",
  () => {
    px.test(
      "easy — select all (expected 1.0 across the board)",
      {
        input: { userQuery: "Show all customers" },
        expected: { sql: "SELECT * FROM customers;" },
      },
      async ({ input, expected }) => {
        await score(input.userQuery, expected?.sql ?? "");
      }
    );

    px.test(
      "medium — numeric filter (still exact here)",
      {
        input: { userQuery: "Which orders are over $100?" },
        expected: { sql: "SELECT * FROM orders WHERE total > 100;" },
      },
      async ({ input, expected }) => {
        await score(input.userQuery, expected?.sql ?? "");
      }
    );

    px.test(
      "hard — boolean flag (right table, missed filter)",
      {
        input: { userQuery: "Show active users" },
        expected: { sql: "SELECT * FROM users WHERE active = TRUE;" },
      },
      async ({ input, expected }) => {
        await score(input.userQuery, expected?.sql ?? "");
      }
    );

    px.test(
      "hard — two conditions (only one captured)",
      {
        input: { userQuery: "Customers in Texas who signed up this year" },
        expected: {
          sql: "SELECT * FROM customers WHERE state = 'Texas' AND signup_date >= '2024-01-01';",
        },
      },
      async ({ input, expected }) => {
        await score(input.userQuery, expected?.sql ?? "");
      }
    );
  },
  {
    acceptanceCriteria: [
      { annotationName: "valid_sql", metric: "passRate", threshold: 1 },
      { annotationName: "correct_table", metric: "passRate", threshold: 1 },
      { annotationName: "token_f1", metric: "average", threshold: 0.8 },
    ],
  }
);

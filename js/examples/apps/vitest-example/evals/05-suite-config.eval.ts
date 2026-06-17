/**
 * 05 — Suite configuration.
 *
 * The third argument to `px.describe` configures the dataset / experiment:
 *   - `datasetName`  — override the dataset + experiment name (defaults to the
 *                      suite name).
 *   - `description`  — shown on the dataset and experiment in Phoenix.
 *   - `metadata`     — recorded on every run in the experiment; handy for
 *                      tagging the model / prompt version under test so you can
 *                      compare experiments across changes.
 *
 * Per-test `config` adds `tags` and `metadata` to an individual run — here we
 * tag each case with its difficulty so you can slice the experiment by it.
 *
 * Run offline:
 *   pnpm eval evals/05-suite-config.eval.ts
 */
import * as px from "@arizeai/phoenix-client/vitest";
import { expect } from "vitest";

import { generateSql } from "../src/app";
import { sqlExactMatch, sqlSimilarity } from "../src/evaluators";

px.describe(
  "text-to-sql: configured suite",
  () => {
    px.test(
      "easy: select all",
      {
        input: { userQuery: "Show all orders" },
        expected: { sql: "SELECT * FROM orders;" },
        // Per-test metadata + tags ride along on this run.
        config: { tags: ["smoke"], metadata: { difficulty: "easy" } },
      },
      async ({ input, expected }) => {
        const { sql } = generateSql(input.userQuery);
        px.recordOutput({ sql });
        await px.evaluate(sqlExactMatch, {
          output: sql,
          expected: expected?.sql ?? "",
        });
        expect(sql).toEqual(expected?.sql);
      }
    );

    px.test(
      "hard: multi-condition filter",
      {
        input: { userQuery: "Customers in Texas who signed up this year" },
        expected: {
          sql: "SELECT * FROM customers WHERE state = 'Texas' AND signup_date >= '2024-01-01';",
        },
        config: { tags: ["regression"], metadata: { difficulty: "hard" } },
      },
      async ({ input, expected }) => {
        const { sql } = generateSql(input.userQuery);
        px.recordOutput({ sql });
        // This one is a known partial: graded, not asserted for exactness.
        await px.evaluate(sqlSimilarity, {
          output: sql,
          expected: expected?.sql ?? "",
        });
        expect(sql).toContain("FROM customers");
      }
    );
  },
  {
    datasetName: "text-to-sql-eval-set",
    description: "Canonical text-to-SQL examples for the Vitest example app.",
    metadata: { model: "rule-based-v1", promptVersion: 3 },
  }
);

/**
 * 05 — Suite configuration.
 *
 * The third argument to `px.describe` configures the dataset / experiment:
 *   - `datasetName`  — override the dataset + experiment name (defaults to the
 *                      suite name).
 *   - `description`  — shown on the dataset and experiment in Phoenix.
 *   - `metadata`     — recorded on every run in the experiment; handy for
 *                      tagging the model / prompt version under test.
 *
 * Run offline:
 *   pnpm eval evals/05-suite-config.eval.ts
 */
import * as px from "@arizeai/phoenix-client/vitest";
import { expect } from "vitest";

import { generateSql } from "../src/app";

px.describe(
  "text-to-sql: configured suite",
  () => {
    px.test(
      "select all",
      {
        input: { userQuery: "show all orders" },
        expected: { sql: "SELECT * FROM orders;" },
        // Per-test metadata + tags ride along on this run.
        config: { tags: ["smoke"], metadata: { difficulty: "easy" } },
      },
      async ({ input, expected }) => {
        const { sql } = generateSql(input.userQuery);
        px.logOutput({ sql });
        expect(sql).toEqual(expected?.sql);
      }
    );
  },
  {
    datasetName: "text-to-sql-eval-set",
    description: "Canonical text-to-SQL examples for the quickstart app.",
    metadata: { model: "rule-based-v1", promptVersion: 3 },
  }
);

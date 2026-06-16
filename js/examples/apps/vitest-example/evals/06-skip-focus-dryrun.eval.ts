/**
 * 06 — Skipping, focusing, and dry-run.
 *
 *   - `px.test.skip` / `px.describe.skip` — declared but not executed.
 *   - `px.test.only`  / `px.describe.only` — run ONLY the focused case(s).
 *     (Left commented out here so this file runs green as a whole — uncomment
 *     to see it filter the suite.)
 *   - `dryRun: true` — run the body locally but upload NOTHING to Phoenix for
 *     that test/suite. Useful for scaffolding a case before it's ready.
 *
 * Run offline:
 *   pnpm eval evals/06-skip-focus-dryrun.eval.ts
 */
import * as px from "@arizeai/phoenix-client/vitest";
import { expect } from "vitest";

import { generateSql } from "../src/app";

px.describe("text-to-sql: skip / focus / dry-run", () => {
  px.test(
    "runs and uploads normally",
    {
      input: { userQuery: "Show all products" },
      expected: { sql: "SELECT * FROM products;" },
    },
    async ({ input, expected }) => {
      const { sql } = generateSql(input.userQuery);
      px.recordOutput({ sql });
      expect(sql).toEqual(expected?.sql);
    }
  );

  px.test.skip(
    "skipped — JOINs aren't supported yet",
    {
      input: { userQuery: "Total revenue per customer" },
      expected: {
        sql: "SELECT customer_id, SUM(total) FROM orders GROUP BY customer_id;",
      },
    },
    async () => {
      throw new Error("should not run");
    }
  );

  px.test(
    "runs locally but is NOT uploaded to Phoenix",
    {
      input: { userQuery: "Draft: customers who churned last quarter" },
      // No dataset example / run / annotations are created for a dryRun test,
      // even when the rest of the suite syncs.
      dryRun: true,
    },
    async ({ input }) => {
      const { sql } = generateSql(input.userQuery);
      px.recordOutput({ sql });
      expect(typeof sql).toBe("string");
    }
  );

  // Uncomment to run ONLY this test in the suite:
  // px.test.only(
  //   "the only test that runs",
  //   { input: { userQuery: "How many users are there?" } },
  //   async ({ input }) => {
  //     const { sql } = generateSql(input.userQuery);
  //     px.recordOutput({ sql });
  //     expect(sql).toContain("COUNT(*)");
  //   }
  // );
});

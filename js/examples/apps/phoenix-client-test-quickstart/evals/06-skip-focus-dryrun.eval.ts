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
      input: { userQuery: "show all products" },
      expected: { sql: "SELECT * FROM products;" },
    },
    async ({ input, expected }) => {
      const { sql } = generateSql(input.userQuery);
      px.logOutput({ sql });
      expect(sql).toEqual(expected?.sql);
    }
  );

  px.test.skip(
    "skipped — never executes",
    { input: { userQuery: "this case is not ready" } },
    async () => {
      throw new Error("should not run");
    }
  );

  px.test(
    "runs locally but is NOT uploaded to Phoenix",
    {
      input: { userQuery: "draft case under development" },
      // No dataset example / run / annotations are created for a dryRun test,
      // even when the rest of the suite syncs.
      dryRun: true,
    },
    async ({ input }) => {
      const { sql } = generateSql(input.userQuery);
      px.logOutput({ sql });
      expect(typeof sql).toBe("string");
    }
  );

  // Uncomment to run ONLY this test in the suite:
  // px.test.only(
  //   "the only test that runs",
  //   { input: { userQuery: "count all users" } },
  //   async ({ input }) => {
  //     const { sql } = generateSql(input.userQuery);
  //     px.logOutput({ sql });
  //     expect(sql).toContain("COUNT(*)");
  //   }
  // );
});

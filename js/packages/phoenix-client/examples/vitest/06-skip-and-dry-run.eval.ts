/**
 * 06 · skip & dry-run — opt cases out of the run, or out of Phoenix.
 *
 * `test.skip` does not execute at all. A `dryRun` case executes locally but
 * creates no dataset example, run, or annotations on Phoenix — handy for
 * scaffolding a case before it is ready to track, even while the rest of the
 * suite syncs.
 */
import * as px from "@arizeai/phoenix-client/vitest";
import { expect } from "vitest";

import { generateSql } from "./app";

px.describe("06 · skip & dry-run", () => {
  px.test(
    "runs and syncs normally",
    {
      input: { userQuery: "all customers" },
      expected: { sql: "SELECT * FROM customers;" },
    },
    async ({ input, expected }) => {
      const output = generateSql(input);
      px.logOutput(output);
      expect(output.sql).toBe(expected?.sql);
    }
  );

  px.test.skip(
    "not implemented yet",
    { input: { userQuery: "natural-language join across three tables" } },
    async () => {
      throw new Error("skipped — this body never runs");
    }
  );

  px.test(
    "executes locally but uploads nothing",
    {
      input: { userQuery: "all orders" },
      expected: { sql: "SELECT * FROM orders;" },
      dryRun: true,
    },
    async ({ input, expected }) => {
      const output = generateSql(input);
      px.logOutput(output);
      expect(output.sql).toBe(expected?.sql);
    }
  );
});

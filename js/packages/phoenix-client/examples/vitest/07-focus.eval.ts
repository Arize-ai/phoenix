/**
 * 07 · Focus — `test.only` (and `describe.only`) run just the focused case,
 * skipping its siblings in this file. Comment out `.only` to run the whole
 * file again. (Focus is file-scoped, so the other example files still run.)
 */
import * as px from "@arizeai/phoenix-client/vitest";
import { expect } from "vitest";

import { generateSql } from "./app";

px.describe("07 · focus", () => {
  px.test.only(
    "only this case runs",
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

  px.test(
    "skipped because a sibling is focused",
    {
      input: { userQuery: "all orders" },
      expected: { sql: "SELECT * FROM orders;" },
    },
    async ({ input }) => {
      px.logOutput(generateSql(input));
    }
  );
});

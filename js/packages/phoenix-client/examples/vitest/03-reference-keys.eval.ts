/**
 * 03 · Reference keys — `expected`, `reference`, and `output` are aliases.
 *
 * All three name the dataset example's reference output and arrive as
 * `expected` in the test body; at most one may be set per case. `px.it` is the
 * canonical alias for `px.test`.
 */
import * as px from "@arizeai/phoenix-client/vitest";
import { expect } from "vitest";

import { generateSql } from "./app";

px.describe("03 · reference keys", () => {
  px.test(
    "via expected",
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
    "via reference",
    {
      input: { userQuery: "all orders" },
      reference: { sql: "SELECT * FROM orders;" },
    },
    async ({ input, expected }) => {
      const output = generateSql(input);
      px.logOutput(output);
      expect(output.sql).toBe(expected?.sql);
    }
  );

  px.it(
    "via output (and the `it` alias)",
    {
      input: { userQuery: "count the users" },
      output: { sql: "SELECT COUNT(*) FROM users;" },
    },
    async ({ input, expected }) => {
      const output = generateSql(input);
      px.logOutput(output);
      expect(output.sql).toBe(expected?.sql);
    }
  );
});

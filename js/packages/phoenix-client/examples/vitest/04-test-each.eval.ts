/**
 * 04 · test.each — fan one handler over a table; each row becomes its own
 * dataset example and experiment run. Names accept `%s` (row input as JSON),
 * `%j` (whole row as JSON), `%i` (row index), or a function that builds the
 * name from the row.
 */
import * as px from "@arizeai/phoenix-client/vitest";
import { expect } from "vitest";

import { generateSql } from "./app";
import { correctness } from "./evaluators";

const cases = [
  {
    input: { userQuery: "all customers" },
    expected: { sql: "SELECT * FROM customers;" },
    metadata: { topic: "customers" },
  },
  {
    input: { userQuery: "all orders" },
    expected: { sql: "SELECT * FROM orders;" },
    metadata: { topic: "orders" },
  },
  {
    input: { userQuery: "count the users" },
    expected: { sql: "SELECT COUNT(*) FROM users;" },
    metadata: { topic: "users" },
  },
];

px.describe("04 · test.each", () => {
  // `%s` interpolates the row's input as JSON into the case name.
  px.test.each(cases)("text-to-sql %s", async ({ input, expected }) => {
    const output = generateSql(input);
    px.logOutput(output);
    await px.evaluate(correctness);
    expect(output.sql).toBe(expected?.sql);
  });

  // A function namer derives the case label from the row.
  px.test.each(cases)(
    (row) => `topic: ${String(row.metadata?.topic)}`,
    async ({ input, expected }) => {
      const output = generateSql(input);
      px.logOutput(output);
      expect(output.sql).toBe(expected?.sql);
    }
  );
});

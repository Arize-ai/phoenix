/**
 * 01 — The basics.
 *
 * A `px.describe` block becomes a Phoenix **dataset** + a new **experiment**.
 * Each `px.test` becomes a dataset **example** (from `input` / `expected`)
 * plus a recorded experiment **run**. Each assertion becomes a `pass`
 * annotation on that run.
 *
 * Run offline (no Phoenix server needed):
 *   pnpm eval evals/01-basics.eval.ts
 */
import * as px from "@arizeai/phoenix-client/vitest";
import { expect } from "vitest";

import { generateSql } from "../src/app";

px.describe("text-to-sql: basics", () => {
  px.test(
    "select all from a table",
    {
      // `input` becomes the dataset example's input.
      input: { userQuery: "Get all users from the customers table" },
      // `expected` becomes the example's reference output.
      expected: { sql: "SELECT * FROM customers;" },
    },
    async ({ input, expected }) => {
      // Call your app under test.
      const { sql } = generateSql(input.userQuery);

      // Record what the app actually produced for this run.
      px.logOutput({ sql });

      // Any assertion failure flips the run's built-in `pass` annotation to 0.
      expect(sql).toEqual(expected?.sql);
    }
  );

  px.test(
    "count rows in a table",
    {
      input: { userQuery: "How many orders are there?" },
      expected: { sql: "SELECT COUNT(*) FROM orders;" },
    },
    async ({ input, expected }) => {
      const { sql } = generateSql(input.userQuery);
      px.logOutput({ sql });
      expect(sql).toEqual(expected?.sql);
    }
  );
});

/**
 * 08 — Multiple explicit tests in one suite.
 *
 * Use separate `px.test` calls when each eval case deserves its own readable
 * name, config, assertions, or setup. This file keeps all four cases under one
 * `px.describe`, so they sync to one Phoenix dataset + experiment.
 *
 * Run offline:
 *   pnpm eval evals/08-four-tests.eval.ts
 */
import * as px from "@arizeai/phoenix-client/vitest";
import { expect } from "vitest";

import { generateSql } from "../src/app";

px.describe("text-to-sql: four explicit cases", () => {
  px.test(
    "select all customers",
    {
      input: { userQuery: "show all customers" },
      expected: { sql: "SELECT * FROM customers;" },
    },
    async ({ input, expected }) => {
      const { sql } = generateSql(input.userQuery);
      px.recordOutput({ sql });
      expect(sql).toEqual(expected?.sql);
    }
  );

  px.test(
    "count orders",
    {
      input: { userQuery: "how many orders are there?" },
      expected: { sql: "SELECT COUNT(*) FROM orders;" },
    },
    async ({ input, expected }) => {
      const { sql } = generateSql(input.userQuery);
      px.recordOutput({ sql });
      expect(sql).toEqual(expected?.sql);
    }
  );

  px.test(
    "select every product",
    {
      input: { userQuery: "show every product in the products table" },
      expected: { sql: "SELECT * FROM products;" },
    },
    async ({ input, expected }) => {
      const { sql } = generateSql(input.userQuery);
      px.recordOutput({ sql });
      expect(sql).toEqual(expected?.sql);
    }
  );

  px.test(
    "list invoices",
    {
      input: { userQuery: "list all invoices" },
      expected: { sql: "SELECT * FROM invoices;" },
    },
    async ({ input, expected }) => {
      const { sql } = generateSql(input.userQuery);
      px.recordOutput({ sql });
      expect(sql).toEqual(expected?.sql);
    }
  );
});

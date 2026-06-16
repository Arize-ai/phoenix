/**
 * The same eval, written for Jest.
 *
 * The only differences from the Vitest examples:
 *   - import from `@arizeai/phoenix-client/jest` instead of `@arizeai/phoenix-client/vitest`
 *   - `expect` is a Jest global (no import needed)
 *
 * Run offline:
 *   pnpm eval:jest
 */
import * as px from "@arizeai/phoenix-client/jest";

import { generateSql, OFFTOPIC_SQL } from "../src/app";

px.describe("text-to-sql (jest): basics", () => {
  px.test(
    "select all from a table",
    {
      input: { userQuery: "Get all users from the customers table" },
      expected: { sql: "SELECT * FROM customers;" },
    },
    async ({ input, expected }) => {
      const { sql } = generateSql(input.userQuery as string);
      px.recordOutput({ sql });
      expect(sql).toEqual(expected?.sql);
    }
  );

  px.test.each([
    { input: { userQuery: "whats up" }, expected: { sql: OFFTOPIC_SQL } },
    { input: { userQuery: "tell me a joke" }, expected: { sql: OFFTOPIC_SQL } },
  ])("refuses offtopic", async ({ input, expected }) => {
    const { sql } = generateSql(input.userQuery as string);
    px.recordOutput({ sql });
    expect(sql).toEqual(expected?.sql);
  });
});

/**
 * 03 — Data-driven evals with `px.test.each`.
 *
 * Drive the same test body across a table of examples. Each row becomes its
 * own dataset example + run, exactly as if you'd written separate `px.test`
 * calls. Great for a fixed eval set or a guardrail suite.
 *
 * Run offline:
 *   pnpm eval evals/03-test-each.eval.ts
 */
import * as px from "@arizeai/phoenix-client/vitest";
import { expect } from "vitest";

import { generateSql, OFFTOPIC_SQL } from "../src/app";

const OFFTOPIC_CASES = [
  { input: { userQuery: "whats up" }, expected: { sql: OFFTOPIC_SQL } },
  {
    input: { userQuery: "what color is the sky?" },
    expected: { sql: OFFTOPIC_SQL },
  },
  { input: { userQuery: "tell me a joke" }, expected: { sql: OFFTOPIC_SQL } },
];

px.describe("text-to-sql: offtopic guardrails", () => {
  // `%s` interpolates the row's stringified input into the test name.
  px.test.each(OFFTOPIC_CASES)(
    "refuses offtopic: %s",
    async ({ input, expected }) => {
      const { sql } = generateSql(input.userQuery);
      px.recordOutput({ sql });
      expect(sql).toEqual(expected?.sql);
    }
  );
});

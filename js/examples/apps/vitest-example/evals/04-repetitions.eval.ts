/**
 * 04 — Repetitions.
 *
 * Run a test (or a whole suite) multiple times against the same dataset
 * example. Each repetition is a separate experiment run carrying a distinct
 * `repetition_number`, so Phoenix's compare view shows them side by side.
 *
 * Our deterministic app returns the same SQL every time, so these runs are
 * identical by design. Against a real LLM they wouldn't be — repetitions are
 * how you measure that non-determinism and decide whether a flaky case is the
 * model's fault or your prompt's.
 *
 * Resolution order: per-test `repetitions` → suite `repetitions` →
 * `PHOENIX_TEST_REPETITIONS` env var → 1.
 *
 * Run offline:
 *   pnpm eval evals/04-repetitions.eval.ts
 */
import * as px from "@arizeai/phoenix-client/vitest";
import { expect } from "vitest";

import { generateSql } from "../src/app";

// The suite default is 2 repetitions...
px.describe(
  "text-to-sql: repetitions",
  () => {
    // ...and this test overrides it to 3.
    px.test(
      "is stable across runs",
      {
        input: { userQuery: "Top 5 products by price" },
        expected: {
          sql: "SELECT * FROM products ORDER BY price DESC LIMIT 5;",
        },
        repetitions: 3,
      },
      async ({ input, expected }) => {
        const { sql } = generateSql(input.userQuery);
        px.logOutput({ sql });
        expect(sql).toEqual(expected?.sql);
      }
    );

    // This test inherits the suite-level 2 repetitions.
    px.test(
      "inherits suite repetitions",
      { input: { userQuery: "How many customers are there?" } },
      async ({ input }) => {
        const { sql } = generateSql(input.userQuery);
        px.logOutput({ sql });
        expect(sql).toContain("COUNT(*)");
      }
    );
  },
  { repetitions: 2 }
);

/**
 * 05 · Repetitions — run a case multiple times to measure non-determinism.
 *
 * Resolution order: per-test `repetitions` → suite `repetitions` →
 * `PHOENIX_TEST_REPETITIONS` → `1`. Each repetition is its own experiment run
 * (carrying a distinct `repetition_number`) against the same dataset example.
 */
import * as px from "@arizeai/phoenix-client/vitest";

import { generateSql } from "./app";
import { tokenF1 } from "./evaluators";

px.describe(
  "05 · repetitions",
  () => {
    // Inherits the suite-level repetitions (2).
    px.test(
      "runs twice (suite default)",
      {
        input: { userQuery: "all customers" },
        expected: { sql: "SELECT * FROM customers;" },
      },
      async ({ input }) => {
        px.logOutput(generateSql(input));
        await px.evaluate(tokenF1);
      }
    );

    // Overrides the suite value for this case only.
    px.test(
      "runs three times (per-test override)",
      {
        input: { userQuery: "all orders" },
        expected: { sql: "SELECT * FROM orders;" },
        repetitions: 3,
      },
      async ({ input }) => {
        px.logOutput(generateSql(input));
        await px.evaluate(tokenF1);
      }
    );
  },
  { repetitions: 2 }
);

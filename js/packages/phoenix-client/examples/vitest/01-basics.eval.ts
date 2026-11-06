/**
 * 01 · Basics — the smallest end-to-end Phoenix eval test.
 *
 * Run the whole example suite offline (nothing is synced to Phoenix):
 *   cd js/packages/phoenix-client
 *   PHOENIX_TEST_TRACKING=false pnpm exec vitest run \
 *     --config examples/vitest/phoenix.vitest.config.ts
 */
import * as px from "@arizeai/phoenix-client/vitest";
import { expect } from "vitest";

import { generateSql } from "./app";
import { correctness } from "./evaluators";

px.describe("01 · basics", () => {
  px.test(
    "generates select-all for the customers table",
    {
      input: { userQuery: "Get all rows from the customers table" },
      expected: { sql: "SELECT * FROM customers;" },
    },
    async ({ input, expected }) => {
      const output = generateSql(input);
      // Record what the app produced; this becomes the experiment run's output.
      px.logOutput(output);
      // Score it — input / output / expected are auto-supplied from the run.
      await px.evaluate(correctness);
      // A plain assertion also gates the test and the built-in `pass` annotation.
      expect(output.sql).toBe(expected?.sql);
    }
  );
});

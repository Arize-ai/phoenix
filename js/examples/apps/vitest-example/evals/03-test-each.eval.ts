/**
 * 03 — Data-driven evals with `px.test.each`.
 *
 * This is the pattern you'll reach for most: run your whole curated eval set
 * through the app in one suite. Each row of `TEXT_TO_SQL_CASES` becomes its own
 * dataset example + run, exactly as if you'd written separate `px.test` calls.
 *
 * Every row is graded by `exact_match` and `token_f1`, so the reporter (and the
 * Phoenix experiment) shows the real distribution: the easy cases score 1.0, the
 * hard ones (boolean flags, multi-condition filters) land in partial-credit
 * territory, and the off-topic guardrail case is refused outright. The test
 * assertion only checks the hard guarantee — valid SQL for data questions, a
 * refusal for everything else — so the suite stays green.
 *
 * Run offline:
 *   pnpm eval evals/03-test-each.eval.ts
 */
import * as px from "@arizeai/phoenix-client/vitest";
import { expect } from "vitest";

import { generateSql, OFFTOPIC_SQL } from "../src/app";
import { TEXT_TO_SQL_CASES } from "../src/dataset";
import { sqlExactMatch, sqlSimilarity } from "../src/evaluators";

px.describe("text-to-sql: full eval set", () => {
  // `%s` interpolates the row's stringified input into the test name.
  px.test.each(TEXT_TO_SQL_CASES)("%s", async ({ input, expected }) => {
    const { sql } = generateSql(input.userQuery);
    px.recordOutput({ sql });

    const reference = expected?.sql ?? "";
    await px.evaluate(sqlExactMatch, { output: sql, expected: reference });
    await px.evaluate(sqlSimilarity, { output: sql, expected: reference });

    // Adaptive guardrail: off-topic asks must be refused; data questions must
    // produce valid SQL against the table the reference uses.
    if (reference === OFFTOPIC_SQL) {
      expect(sql).toBe(OFFTOPIC_SQL);
    } else {
      const table = reference.toLowerCase().match(/\bfrom\s+(\w+)/)?.[1];
      expect(sql).toMatch(/^SELECT/i);
      expect(sql.toLowerCase()).toContain(`from ${table}`);
    }
  });
});

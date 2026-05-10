// @ts-nocheck — example file; LLM SDK imports are illustrative.
/**
 * Example: a Phoenix-flavored vitest suite.
 *
 * Run with:
 *   pnpm exec vitest run --config phoenix.vitest.config.ts examples/sql.eval.ts
 *
 * Expected env vars (when tracking to a Phoenix server):
 *   PHOENIX_HOST=https://app.phoenix.arize.com
 *   PHOENIX_API_KEY=...
 *   OPENAI_API_KEY=...
 *
 * Without those, the suite still runs locally; sync to Phoenix is skipped
 * when `PHOENIX_TEST_TRACKING=false`.
 *
 * NOTE: this file demonstrates the API only — the imports below are not
 * dependencies of `@arizeai/phoenix-test` itself. Install whichever LLM
 * client / instrumentation you need in your own project.
 */
import * as px from "@arizeai/phoenix-test";
import OpenAI from "openai";
import { expect } from "vitest";

const openai = new OpenAI();

async function generateSql(userQuery: string): Promise<string> {
  const result = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "Convert the user query to a SQL query. Do not wrap in markdown.",
      },
      { role: "user", content: userQuery },
    ],
  });
  return result.choices[0]?.message.content ?? "";
}

const correctness = px.wrapEvaluator(
  async ({
    output,
    expected,
  }: {
    output: { sql: string };
    expected: { sql: string };
  }) => {
    const grade = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "Return 1 if ACTUAL and EXPECTED are semantically equivalent, otherwise 0.",
        },
        {
          role: "user",
          content: `ACTUAL: ${output.sql}\nEXPECTED: ${expected.sql}`,
        },
      ],
    });
    const score = parseInt(grade.choices[0]?.message.content ?? "0", 10);
    return { name: "correctness", score };
  }
);

px.describe("generate sql demo", () => {
  px.test(
    "generates select all",
    {
      input: { userQuery: "Get all users from the customers table" },
      expected: { sql: "SELECT * FROM customers;" },
    },
    async ({ input, expected }) => {
      const sql = await generateSql(input.userQuery as string);
      px.logOutput({ sql });
      await correctness({
        output: { sql },
        expected: expected ?? { sql: "" },
      });
      expect(sql).toEqual(expected?.sql);
    }
  );

  px.test.each([
    {
      input: { userQuery: "whats up" },
      expected: { sql: "sorry that is not a valid query" },
    },
    {
      input: { userQuery: "what color is the sky?" },
      expected: { sql: "sorry that is not a valid query" },
    },
  ])("offtopic input", async ({ input, expected }) => {
    const sql = await generateSql(input.userQuery as string);
    px.logOutput({ sql });
    await correctness({
      output: { sql },
      expected: expected ?? { sql: "" },
    });
  });
});

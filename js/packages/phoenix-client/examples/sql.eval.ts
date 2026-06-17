// @ts-nocheck — example file; LLM SDK imports are illustrative.
/**
 * Example: a Phoenix-flavored vitest suite.
 *
 * Run with:
 *   cd js/packages/phoenix-client
 *   OPENAI_API_KEY= PHOENIX_TEST_TRACKING=false pnpm exec vitest run \
 *     --config examples/phoenix.vitest.config.ts examples/sql.eval.ts
 *
 * Expected env vars (when tracking to a Phoenix server):
 *   PHOENIX_HOST=https://app.phoenix.arize.com
 *   PHOENIX_API_KEY=...
 *   OPENAI_API_KEY=...
 *
 * Without those, the suite still runs locally using a deterministic stand-in;
 * sync to Phoenix is skipped when `PHOENIX_TEST_TRACKING=false`.
 *
 * NOTE: this file demonstrates the API only — the imports below are not
 * dependencies of `@arizeai/phoenix-client` itself. Install whichever LLM
 * client / instrumentation you need in your own project.
 */
import * as px from "@arizeai/phoenix-client/vitest";
import { createEvaluator } from "@arizeai/phoenix-evals";
import OpenAI from "openai";
import { expect } from "vitest";

const HAS_OPENAI = Boolean(process.env.OPENAI_API_KEY);
let client: OpenAI | undefined;

function openai(): OpenAI {
  return (client ??= new OpenAI());
}

function generateSqlOffline(userQuery: string): string {
  const query = userQuery.toLowerCase();
  if (query.includes("customers table")) {
    return "SELECT * FROM customers;";
  }
  return "sorry that is not a valid query";
}

async function generateSql(userQuery: string): Promise<string> {
  if (!HAS_OPENAI) {
    return generateSqlOffline(userQuery);
  }
  const result = await openai().chat.completions.create({
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

function gradeCorrectnessOffline({
  output,
  expected,
}: {
  output: { sql: string };
  expected: { sql: string };
}): number {
  return output.sql.trim().toLowerCase() === expected.sql.trim().toLowerCase()
    ? 1
    : 0;
}

const correctness = createEvaluator(
  async ({
    output,
    expected,
  }: {
    output: { sql: string };
    expected: { sql: string };
  }) => {
    if (!HAS_OPENAI) {
      return { score: gradeCorrectnessOffline({ output, expected }) };
    }
    const grade = await openai().chat.completions.create({
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
    return { score };
  },
  { name: "correctness", kind: "LLM" }
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
      px.recordOutput({ sql });
      await px.evaluate(correctness, {
        output: { sql },
        expected: expected ?? { sql: "" },
      });
      expect(sql.toUpperCase()).toContain("SELECT");
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
    px.recordOutput({ sql });
    await px.evaluate(correctness, {
      output: { sql },
      expected: expected ?? { sql: "" },
    });
  });
});

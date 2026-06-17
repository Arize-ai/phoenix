/**
 * 07 — The real thing: an LLM-backed eval (OpenAI).
 *
 * Everything above uses a deterministic stand-in so the examples run offline.
 * This file shows the production shape: call an LLM inside the test, grade it
 * with an LLM-as-a-judge, and let OpenInference capture the model calls as
 * child spans of each test's task span.
 *
 * This suite is **skipped automatically** unless `OPENAI_API_KEY` is set, so
 * the default `pnpm eval` stays green and free. To run it for real:
 *
 *   export OPENAI_API_KEY=sk-...
 *   export PHOENIX_HOST=http://localhost:6006   # or your Phoenix endpoint
 *   pnpm eval:phoenix evals/07-llm-openai.eval.ts
 */
import { OpenAIInstrumentation } from "@arizeai/openinference-instrumentation-openai";
import * as px from "@arizeai/phoenix-client/vitest";
import { createEvaluator } from "@arizeai/phoenix-evals";
import OpenAI from "openai";
import { expect } from "vitest";

const HAS_OPENAI = Boolean(process.env.OPENAI_API_KEY);

let isOpenAIInstrumented = false;

function ensureOpenAIInstrumented(): void {
  if (!HAS_OPENAI || isOpenAIInstrumented) {
    return;
  }
  // Phoenix attaches the suite tracer provider in beforeAll. Construct the
  // OpenAI instrumentation after that so it uses the Phoenix provider.
  new OpenAIInstrumentation().manuallyInstrument(OpenAI);
  isOpenAIInstrumented = true;
}

// Only declare the suite when we have a key; otherwise skip it cleanly.
const suite = HAS_OPENAI ? px.describe : px.describe.skip;

suite(
  "text-to-sql: openai (live)",
  () => {
    // Construct the client lazily. The `describe` body runs at collection time
    // even for a skipped suite, so building `new OpenAI()` here (rather than
    // inside the test bodies) would throw when `OPENAI_API_KEY` is unset.
    let client: OpenAI | undefined;
    const openai = () => {
      ensureOpenAIInstrumented();
      return (client ??= new OpenAI());
    };

    async function generateSql(userQuery: string): Promise<string> {
      const result = await openai().chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "Convert the user request into a single SQL query. " +
              "Return only the SQL, with no markdown fences.",
          },
          { role: "user", content: userQuery },
        ],
      });
      return result.choices[0]?.message.content?.trim() ?? "";
    }

    // An LLM-as-a-judge. Same evaluator-object shape as the offline evaluators;
    // it just awaits a model call. Traced as its own EVALUATOR span.
    const correctness = createEvaluator(
      async ({ output, expected }: { output: string; expected: string }) => {
        const grade = await openai().chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content:
                "You grade SQL. Reply with 1 if ACTUAL and EXPECTED are " +
                "semantically equivalent, otherwise 0. Reply with only the digit.",
            },
            {
              role: "user",
              content: `ACTUAL: ${output}\nEXPECTED: ${expected}`,
            },
          ],
        });
        const score = grade.choices[0]?.message.content?.includes("1") ? 1 : 0;
        return { score };
      },
      { name: "correctness", kind: "LLM" }
    );

    px.test(
      "generates select all",
      {
        input: { userQuery: "Get all users from the customers table" },
        expected: { sql: "SELECT * FROM customers;" },
      },
      async ({ input, expected }) => {
        const sql = await generateSql(input.userQuery);
        px.recordOutput({ sql });
        await px.evaluate(correctness, {
          output: sql,
          expected: expected?.sql ?? "",
        });
        expect(sql.toUpperCase()).toContain("SELECT");
      }
    );
  },
  { metadata: { model: "gpt-4o-mini" } }
);

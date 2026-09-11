import { describe, expect, it } from "vitest";

import type { PromptTemplate } from "@arizeai/phoenix-evals";

import { bindSweepEvaluator } from "./bindSweepEvaluator.js";

describe("bindSweepEvaluator", () => {
  it("passes the original record through on the default format", async () => {
    const seen: unknown[] = [];
    const { evaluate } = bindSweepEvaluator({
      evaluatorId: "hallucination",
      promptTechnique: "default",
      dataFormat: "default",
      createEvaluator: () => ({
        promptTemplate: "<data>{{input}}</data>",
        evaluate: async (record) => {
          seen.push(record);
          return { label: "ok" };
        },
      }),
    });
    await evaluate({ input: "hello", output: "world" });
    expect(seen).toEqual([{ input: "hello", output: "world" }]);
  });

  it("rewrites the template and json-encodes the record for json format", async () => {
    let boundTemplate: PromptTemplate | undefined;
    const seen: unknown[] = [];
    const { evaluate } = bindSweepEvaluator({
      evaluatorId: "hallucination",
      promptTechnique: "default",
      dataFormat: "json",
      createEvaluator: ({ promptTemplate }) => {
        if (promptTemplate !== undefined) {
          boundTemplate = promptTemplate;
        }
        return {
          promptTemplate: promptTemplate ?? "<rubric/><data>{{input}}</data>",
          evaluate: async (record) => {
            seen.push(record);
            return { label: "ok" };
          },
        };
      },
    });
    await evaluate({ input: "hello" });
    expect(boundTemplate).toContain("{{json}}");
    expect(seen).toEqual([{ json: JSON.stringify({ input: "hello" }) }]);
  });
});

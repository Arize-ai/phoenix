import { MockLanguageModelV3 } from "ai/test";
import { describe, expect, it } from "vitest";

import { generateClassifications } from "../../src/llm/generateClassifications";
import type { ClassificationCriterion } from "../../src/types/evals";

const CRITERIA: [ClassificationCriterion, ...ClassificationCriterion[]] = [
  {
    name: "sentiment",
    labels: ["positive", "negative"],
    instruction: "Is the sentiment positive or negative?",
  },
  {
    name: "toxicity",
    labels: ["toxic", "non_toxic"],
    instruction: "Is the text toxic?",
  },
];

/**
 * A language model whose `doGenerate` answers every criterion at once with the
 * given labels, and counts how many times it was called.
 */
function createMockModel(labelByCriterion: Record<string, string>) {
  const state = { generateCalls: 0, lastResponseFormat: undefined as unknown };
  const model = new MockLanguageModelV3({
    doGenerate: async (options) => {
      state.generateCalls += 1;
      state.lastResponseFormat = options.responseFormat;
      const object = Object.fromEntries(
        Object.entries(labelByCriterion).map(([name, label]) => [
          name,
          { label, explanation: `because ${label}` },
        ])
      );
      return {
        finishReason: { unified: "stop", raw: undefined },
        usage: {
          inputTokens: { total: 10, noCache: 10 },
          outputTokens: { total: 10, text: 10 },
        },
        content: [{ type: "text", text: JSON.stringify(object) }],
        warnings: [],
      };
    },
  });
  return { model, state };
}

describe("generateClassifications", () => {
  it("answers all criteria in a single model call, one result per criterion", async () => {
    const { model, state } = createMockModel({
      sentiment: "positive",
      toxicity: "non_toxic",
    });

    const results = await generateClassifications({
      model,
      criteria: CRITERIA,
      prompt: "Classify this text.",
      telemetry: { isEnabled: false },
    });

    expect(state.generateCalls).toBe(1);
    expect(results).toEqual([
      {
        name: "sentiment",
        label: "positive",
        explanation: "because positive",
      },
      {
        name: "toxicity",
        label: "non_toxic",
        explanation: "because non_toxic",
      },
    ]);
  });

  it("builds one schema property per criterion keyed by its name", async () => {
    const { model, state } = createMockModel({
      sentiment: "negative",
      toxicity: "toxic",
    });

    await generateClassifications({
      model,
      criteria: CRITERIA,
      prompt: "Classify this text.",
      telemetry: { isEnabled: false },
    });

    const responseFormat = state.lastResponseFormat as {
      type: string;
      schema: { properties: Record<string, unknown>; required: string[] };
    };
    expect(responseFormat.type).toBe("json");
    expect(Object.keys(responseFormat.schema.properties)).toEqual([
      "sentiment",
      "toxicity",
    ]);
    expect(responseFormat.schema.required).toEqual(["sentiment", "toxicity"]);
  });
});

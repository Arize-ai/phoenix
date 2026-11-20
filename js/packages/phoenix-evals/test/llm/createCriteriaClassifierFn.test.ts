import { MockLanguageModelV3 } from "ai/test";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createClassificationEvaluator } from "../../src";
import { createCriteriaClassifierFn } from "../../src/llm/createClassifierFn";
import * as generateClassificationsModule from "../../src/llm/generateClassifications";
import type { Criterion } from "../../src/types/evals";

const CRITERIA: Criterion[] = [
  {
    name: "sentiment",
    instruction: "Is the sentiment positive or negative?",
    choices: { positive: 1, negative: 0 },
  },
  {
    name: "toxicity",
    instruction: "Is the text toxic?",
    choices: { toxic: 1, non_toxic: 0 },
  },
];

function createMockModel(labelByCriterion: Record<string, string>) {
  return new MockLanguageModelV3({
    doGenerate: async () => {
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
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createCriteriaClassifierFn", () => {
  it("maps each criterion's label to its score", async () => {
    const classify = createCriteriaClassifierFn({
      model: createMockModel({ sentiment: "positive", toxicity: "toxic" }),
      choices: CRITERIA,
      promptTemplate: "Classify: {{text}}",
      telemetry: { isEnabled: false },
    });

    const results = await classify({ text: "whatever" });

    expect(results).toEqual([
      {
        name: "sentiment",
        label: "positive",
        score: 1,
        explanation: "because positive",
        metadata: undefined,
      },
      {
        name: "toxicity",
        label: "toxic",
        score: 1,
        explanation: "because toxic",
        metadata: undefined,
      },
    ]);
  });

  it("throws when the backend returns a label outside the criterion's choices", async () => {
    vi.spyOn(
      generateClassificationsModule,
      "generateClassifications"
    ).mockResolvedValue([
      { name: "sentiment", label: "bogus", explanation: "" },
      { name: "toxicity", label: "toxic", explanation: "" },
    ]);

    const classify = createCriteriaClassifierFn({
      model: createMockModel({}),
      choices: CRITERIA,
      promptTemplate: "Classify: {{text}}",
      telemetry: { isEnabled: false },
    });

    await expect(classify({ text: "whatever" })).rejects.toThrow(
      /invalid label 'bogus'/
    );
  });

  it("rejects duplicate criterion names at construction", () => {
    expect(() =>
      createCriteriaClassifierFn({
        model: createMockModel({}),
        choices: [CRITERIA[0]!, CRITERIA[0]!],
        promptTemplate: "Classify: {{text}}",
        telemetry: { isEnabled: false },
      })
    ).toThrow(/unique/);
  });

  it("rejects a criterion with an empty instruction at construction", () => {
    expect(() =>
      createCriteriaClassifierFn({
        model: createMockModel({}),
        choices: [{ name: "sentiment", instruction: "", choices: { a: 1 } }],
        promptTemplate: "Classify: {{text}}",
        telemetry: { isEnabled: false },
      })
    ).toThrow(/non-empty instruction/);
  });
});

describe("ClassificationEvaluator path selection", () => {
  it("evaluate() throws on a criteria-list evaluator", async () => {
    const evaluator = createClassificationEvaluator({
      name: "multi",
      model: createMockModel({ sentiment: "positive", toxicity: "toxic" }),
      promptTemplate: "Classify: {{text}}",
      telemetry: { isEnabled: false },
      choices: CRITERIA,
    });

    await expect(evaluator.evaluate({ text: "whatever" })).rejects.toThrow(
      /evaluateCriteria/
    );
  });

  it("evaluateCriteria() throws on a single-choices-map evaluator", async () => {
    const evaluator = createClassificationEvaluator({
      name: "single",
      model: createMockModel({ single: "positive" }),
      promptTemplate: "Classify: {{text}}",
      telemetry: { isEnabled: false },
      choices: { positive: 1, negative: 0 },
    });

    await expect(
      evaluator.evaluateCriteria({ text: "whatever" })
    ).rejects.toThrow(/evaluate\(\)/);
  });
});

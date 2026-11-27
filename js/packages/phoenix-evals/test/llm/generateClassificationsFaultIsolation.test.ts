/**
 * The LLM path's fault isolation runs against the real `generateObject`. Each
 * criterion is a nullable property with a free-form `label`, so a criterion the
 * model declines (null) or answers with an off-list label does not reject the
 * whole call: the declined one becomes an `error` failure and the off-list one
 * is returned verbatim, while siblings are unaffected.
 */
import { MockLanguageModelV3 } from "ai/test";
import { describe, expect, it } from "vitest";

import { generateClassifications } from "../../src/llm/generateClassifications";
import type { ClassificationCriterion } from "../../src/types/evals";

const CRITERIA: [ClassificationCriterion, ...ClassificationCriterion[]] = [
  {
    name: "sentiment",
    labels: { positive: null, negative: null },
    instruction: "Is the sentiment positive or negative?",
  },
  {
    name: "toxicity",
    labels: { toxic: null, non_toxic: null },
    instruction: "Is the text toxic?",
  },
];

/** A language model that answers with exactly the given object, as JSON. */
function createMockModel(object: Record<string, unknown>) {
  return new MockLanguageModelV3({
    doGenerate: async () => ({
      finishReason: { unified: "stop", raw: undefined },
      usage: {
        inputTokens: { total: 10, noCache: 10 },
        outputTokens: { total: 10, text: 10 },
      },
      content: [{ type: "text", text: JSON.stringify(object) }],
      warnings: [],
    }),
  });
}

describe("generateClassifications fault isolation", () => {
  it("reports a criterion the model declines (null) as an error failure, keeping its siblings", async () => {
    const outcomes = await generateClassifications({
      model: createMockModel({
        sentiment: { label: "positive", explanation: "because positive" },
        toxicity: null,
      }),
      criteria: CRITERIA,
      prompt: "Classify this text.",
      telemetry: { isEnabled: false },
    });

    expect(outcomes[0]).toEqual({
      name: "sentiment",
      label: "positive",
      explanation: "because positive",
    });
    expect(outcomes[1]).toEqual({
      name: "toxicity",
      kind: "error",
      reason: expect.stringContaining("no answer for criterion 'toxicity'"),
    });
  });

  it("returns an off-list label verbatim rather than failing the whole call, keeping its siblings", async () => {
    const outcomes = await generateClassifications({
      model: createMockModel({
        sentiment: { label: "maybe", explanation: "unsure" },
        toxicity: { label: "non_toxic", explanation: "clean" },
      }),
      criteria: CRITERIA,
      prompt: "Classify this text.",
      telemetry: { isEnabled: false },
    });

    // generateClassifications does not validate labels; it returns the label as
    // given so the caller (createCriteriaClassifierFn) can isolate it.
    expect(outcomes[0]).toEqual({
      name: "sentiment",
      label: "maybe",
      explanation: "unsure",
    });
    expect(outcomes[1]).toEqual({
      name: "toxicity",
      label: "non_toxic",
      explanation: "clean",
    });
  });
});

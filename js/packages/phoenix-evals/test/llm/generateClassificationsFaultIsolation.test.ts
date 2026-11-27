/**
 * The LLM path's fault isolation: a criterion missing from the model's object
 * becomes an `error` failure for that criterion alone. `generateObject` is
 * mocked because the real one validates against the schema and would reject a
 * missing property for the whole call before this code runs.
 */
import type * as AiModule from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { generateClassifications } from "../../src/llm/generateClassifications";
import type { ClassificationCriterion } from "../../src/types/evals";

const { generateObjectMock } = vi.hoisted(() => ({
  generateObjectMock: vi.fn(),
}));

vi.mock("ai", async (importActual) => {
  const actual = await importActual<typeof AiModule>();
  return { ...actual, generateObject: generateObjectMock };
});

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

beforeEach(() => {
  generateObjectMock.mockReset();
});

describe("generateClassifications fault isolation", () => {
  it("reports a criterion missing from the model object as an error failure, keeping its siblings", async () => {
    generateObjectMock.mockResolvedValue({
      object: {
        sentiment: { label: "positive", explanation: "because positive" },
        // No entry for "toxicity".
      },
    });

    const outcomes = await generateClassifications({
      // The model only matters to isDecisionModel; a plain object is not one.
      model: {} as never,
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
});

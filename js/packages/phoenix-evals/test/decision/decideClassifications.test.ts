/**
 * Unit tests for the fault-isolation behavior of {@link decideClassifications}.
 * `experimental_decide` is mocked so we can drive the two outcomes the real
 * provider turns into whole-call errors (a refusal) or that it never emits (a
 * missing answer) without a live model.
 */
import { Experimental_DecisionRefusalError } from "ai";
import type * as AiModule from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { decideClassifications } from "../../src/decision/decideClassifications";
import type { ClassificationCriterion } from "../../src/types/evals";
import type { DecisionModel } from "../../src/utils/isDecisionModel";

const { decideMock } = vi.hoisted(() => ({ decideMock: vi.fn() }));

vi.mock("ai", async (importActual) => {
  const actual = await importActual<typeof AiModule>();
  return { ...actual, experimental_decide: decideMock };
});

const CRITERIA: ClassificationCriterion[] = [
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

const model = {} as DecisionModel;
const prompt = { prompt: "Classify this text." };

beforeEach(() => {
  decideMock.mockReset();
});

describe("decideClassifications fault isolation", () => {
  it("maps a refusal to a refusal failure for every criterion", async () => {
    decideMock.mockRejectedValue(
      new Experimental_DecisionRefusalError({
        questionIds: ["sentiment", "toxicity"],
        provider: "openai",
        modelId: "gpt-6-luna",
      })
    );

    const outcomes = await decideClassifications({
      model,
      criteria: CRITERIA,
      prompt,
      telemetry: { isEnabled: false },
    });

    expect(outcomes).toEqual([
      { name: "sentiment", kind: "refusal", reason: expect.any(String) },
      { name: "toxicity", kind: "refusal", reason: expect.any(String) },
    ]);
  });

  it("reports a criterion the model leaves unanswered as an error failure, keeping its siblings", async () => {
    decideMock.mockResolvedValue({
      answers: {
        sentiment: {
          type: "choice",
          choice: "positive",
          probabilities: { positive: 0.9, negative: 0.1 },
        },
        // No answer for "toxicity".
      },
      providerMetadata: {},
      response: { modelId: "gpt-6-luna" },
    });

    const outcomes = await decideClassifications({
      model,
      criteria: CRITERIA,
      prompt,
      telemetry: { isEnabled: false },
    });

    expect(outcomes[0]).toEqual({
      name: "sentiment",
      label: "positive",
      metadata: {
        probabilities: { positive: 0.9, negative: 0.1 },
        modelId: "gpt-6-luna",
      },
    });
    expect(outcomes[1]).toEqual({
      name: "toxicity",
      kind: "error",
      reason: expect.stringContaining("no answer for criterion 'toxicity'"),
    });
  });

  it("re-throws errors that are not refusals", async () => {
    decideMock.mockRejectedValue(new Error("network down"));

    await expect(
      decideClassifications({
        model,
        criteria: CRITERIA,
        prompt,
        telemetry: { isEnabled: false },
      })
    ).rejects.toThrow(/network down/);
  });
});

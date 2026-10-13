import { describe, expect, it, vi } from "vitest";

import { createCorrectnessEvaluator } from "../../src";
import { generateClassification } from "../../src/llm/generateClassification";
import {
  type DecisionModel,
  isDecisionModel,
} from "../../src/utils/isDecisionModel";

type Experimental_DecisionModelV4 = Extract<
  DecisionModel,
  { doDecide: unknown }
>;

type DecideOptions = Parameters<Experimental_DecisionModelV4["doDecide"]>[0];
type DecideResult = Awaited<
  ReturnType<Experimental_DecisionModelV4["doDecide"]>
>;

function createMockDecisionModel(
  answer:
    | { choice: string; probabilities?: Record<string, number> }
    | { refusal: true },
  extra: Partial<DecideResult> = {}
) {
  const doDecide = vi.fn(
    async (options: DecideOptions): Promise<DecideResult> => ({
      answers: Object.fromEntries(
        Object.keys(options.questions).map((id) => [
          id,
          "refusal" in answer
            ? { type: "refusal" as const }
            : { type: "choice" as const, ...answer },
        ])
      ),
      warnings: [],
      ...extra,
    })
  );
  const model: Experimental_DecisionModelV4 = {
    specificationVersion: "v4",
    provider: "mock",
    modelId: "mock-decision-model",
    supportedQuestionTypes: ["choice"],
    doDecide,
  };
  return { model, doDecide };
}

/**
 * The text sent as state. phoenix-evals passes a string, which `ai`
 * normalizes into a single text part before calling the provider.
 */
function stateText(call: DecideOptions): string {
  expect(call.state).toEqual([{ type: "text", text: expect.any(String) }]);
  return (call.state as unknown as [{ text: string }])[0].text;
}

describe("generateClassification with a decision model", () => {
  it("routes a text prompt through a single choice question", async () => {
    const { model, doDecide } = createMockDecisionModel({
      choice: "incorrect",
      probabilities: { correct: 0.03, incorrect: 0.97 },
    });

    const result = await generateClassification({
      model,
      labels: ["correct", "incorrect"],
      prompt: "Is 2 + 2 = 5 correct?",
    });

    expect(result).toEqual({
      label: "incorrect",
      metadata: {
        probabilities: { correct: 0.03, incorrect: 0.97 },
        modelId: "mock-decision-model",
      },
    });
    expect(result.explanation).toBeUndefined();
    expect(doDecide).toHaveBeenCalledTimes(1);
    const call = doDecide.mock.calls[0]![0];
    expect(stateText(call)).toBe("Is 2 + 2 = 5 correct?");
    expect(call.questions).toEqual({
      label: {
        type: "choice",
        instructions: expect.any(String),
        criteria: { correct: null, incorrect: null },
      },
    });
  });

  it("still accepts models written against the older evaluation spec", async () => {
    const { model: decisionModel, doDecide } = createMockDecisionModel({
      choice: "correct",
    });
    const { doDecide: _unused, ...rest } = decisionModel;
    const evaluationModel = { ...rest, doEvaluate: doDecide };

    const result = await generateClassification({
      model: evaluationModel,
      labels: ["correct", "incorrect"],
      prompt: "Is 2 + 2 = 4 correct?",
    });

    expect(result.label).toBe("correct");
    expect(doDecide).toHaveBeenCalledTimes(1);
  });
});

describe("createClassificationEvaluator with a decision model", () => {
  it("sends the rendered template as the state", async () => {
    const { model, doDecide } = createMockDecisionModel({
      choice: "incorrect",
      probabilities: { correct: 0.1, incorrect: 0.9 },
    });
    const evaluator = createCorrectnessEvaluator({ model });

    const result = await evaluator.evaluate({
      input: "What is the capital of Australia?",
      output: "Sydney.",
    });

    expect(result).toEqual({
      label: "incorrect",
      score: 0,
      metadata: {
        probabilities: { correct: 0.1, incorrect: 0.9 },
        modelId: "mock-decision-model",
      },
    });
    const state = stateText(doDecide.mock.calls[0]![0]);
    expect(state).toContain("<rubric>");
    expect(state).toContain("What is the capital of Australia?");
    expect(state).toContain("Sydney.");
  });
});

describe("isDecisionModel", () => {
  it("distinguishes decision models from language model ids and objects", () => {
    const { model } = createMockDecisionModel({ choice: "correct" });
    expect(isDecisionModel(model)).toBe(true);
    expect(isDecisionModel("gpt-4o-mini")).toBe(false);
  });
});

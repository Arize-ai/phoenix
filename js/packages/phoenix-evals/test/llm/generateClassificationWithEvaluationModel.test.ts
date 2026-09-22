import { describe, expect, it, vi } from "vitest";

import { createClassificationEvaluator } from "../../src";
import { generateClassification } from "../../src/llm/generateClassification";
import { type EvaluationModel, isEvaluationModel } from "../../src/utils";

function createMockEvaluationModel(choice: string) {
  const doEvaluate = vi.fn(
    async (options: Parameters<EvaluationModel["doEvaluate"]>[0]) => ({
      answers: Object.fromEntries(
        Object.keys(options.questions).map((id) => [
          id,
          { type: "choice" as const, choice },
        ])
      ),
      warnings: [],
    })
  );
  const model: EvaluationModel = {
    specificationVersion: "v4",
    provider: "mock",
    modelId: "mock-evaluation-model",
    supportedQuestionTypes: ["choice"],
    doEvaluate,
  };
  return { model, doEvaluate };
}

describe("generateClassification with an evaluation model", () => {
  it("routes a text prompt through a single choice question", async () => {
    const { model, doEvaluate } = createMockEvaluationModel("incorrect");

    const result = await generateClassification({
      model,
      labels: ["correct", "incorrect"],
      prompt: "Is 2 + 2 = 5 correct?",
    });

    expect(result).toEqual({ label: "incorrect" });
    expect(result.explanation).toBeUndefined();
    expect(doEvaluate).toHaveBeenCalledTimes(1);
    const call = doEvaluate.mock.calls[0]![0];
    expect(call.state).toBe("Is 2 + 2 = 5 correct?");
    expect(call.questions).toEqual({
      label: {
        type: "choice",
        instructions: expect.any(String),
        criteria: { correct: null, incorrect: null },
      },
    });
  });

  it("serializes message prompts into JSON state", async () => {
    const { model, doEvaluate } = createMockEvaluationModel("correct");

    await generateClassification({
      model,
      labels: ["correct", "incorrect"],
      system: "You are a strict grader.",
      messages: [{ role: "user", content: "Is the sky blue?" }],
    });

    expect(doEvaluate.mock.calls[0]![0].state).toEqual({
      system: "You are a strict grader.",
      messages: [{ role: "user", content: "Is the sky blue?" }],
    });
  });

  it("keeps instructions in the state instead of dropping them", async () => {
    const { model, doEvaluate } = createMockEvaluationModel("correct");

    await generateClassification({
      model,
      labels: ["correct", "incorrect"],
      instructions: "You are a strict grader.",
      prompt: "Is the sky blue?",
    });

    expect(doEvaluate.mock.calls[0]![0].state).toEqual({
      instructions: "You are a strict grader.",
      prompt: "Is the sky blue?",
    });
  });

  it("surfaces answers outside the label set as an error", async () => {
    const { model } = createMockEvaluationModel("maybe");

    await expect(
      generateClassification({
        model,
        labels: ["correct", "incorrect"],
        prompt: "Is 2 + 2 = 4 correct?",
      })
    ).rejects.toThrow();
  });
});

describe("createClassificationEvaluator with an evaluation model", () => {
  it("maps the chosen label to a score without an explanation", async () => {
    const { model, doEvaluate } = createMockEvaluationModel("invalid");
    const evaluator = createClassificationEvaluator<{ question: string }>({
      name: "isValid",
      model,
      promptTemplate: [
        { role: "system", content: "You judge questions." },
        {
          role: "user",
          content: "is the following question valid: {{question}}",
        },
      ],
      choices: { valid: 1, invalid: 0 },
    });

    const result = await evaluator.evaluate({ question: "asdf" });

    expect(result).toEqual({ label: "invalid", score: 0 });
    expect(doEvaluate).toHaveBeenCalledTimes(1);
    expect(doEvaluate.mock.calls[0]![0].state).toEqual({
      prompt: [
        { role: "system", content: "You judge questions." },
        { role: "user", content: "is the following question valid: asdf" },
      ],
    });
  });
});

describe("isEvaluationModel", () => {
  it("distinguishes evaluation models from language model ids and objects", () => {
    const { model } = createMockEvaluationModel("correct");
    expect(isEvaluationModel(model)).toBe(true);
    expect(isEvaluationModel("gpt-4o-mini")).toBe(false);
  });
});

import { describe, expect, it, vi } from "vitest";

import {
  ClassificationRefusalError,
  createClassificationEvaluator,
  createCorrectnessEvaluator,
} from "../../src";
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

  it("joins system text and messages into one plain-text state", async () => {
    const { model, doDecide } = createMockDecisionModel({ choice: "correct" });

    await generateClassification({
      model,
      labels: ["correct", "incorrect"],
      system: "You are a strict grader.",
      messages: [
        {
          role: "user",
          content: [{ type: "text", text: "Is the sky blue?" }],
        },
      ],
    });

    expect(stateText(doDecide.mock.calls[0]![0])).toBe(
      "You are a strict grader.\n\nIs the sky blue?"
    );
  });

  it("returns the provider's confidence when it reports one", async () => {
    const { model } = createMockDecisionModel(
      { choice: "correct", probabilities: { correct: 0.9, incorrect: 0.1 } },
      { providerMetadata: { openai: { confidence: { label: 0.8 } } } }
    );

    const result = await generateClassification({
      model,
      labels: ["correct", "incorrect"],
      prompt: "Is 2 + 2 = 4 correct?",
    });

    expect(result.metadata).toEqual({
      probabilities: { correct: 0.9, incorrect: 0.1 },
      confidence: 0.8,
      modelId: "mock-decision-model",
    });
  });

  it("turns a refusal into a ClassificationRefusalError", async () => {
    const { model } = createMockDecisionModel({ refusal: true });

    const result = generateClassification({
      model,
      labels: ["a", "b"],
      prompt: "x",
    });

    await expect(result).rejects.toBeInstanceOf(ClassificationRefusalError);
    await expect(result).rejects.toMatchObject({
      modelId: "mock-decision-model",
      message: expect.stringContaining("refused to classify"),
    });
  });

  it("surfaces answers outside the label set as an error", async () => {
    const { model } = createMockDecisionModel({ choice: "maybe" });

    await expect(
      generateClassification({
        model,
        labels: ["correct", "incorrect"],
        prompt: "Is 2 + 2 = 4 correct?",
      })
    ).rejects.toThrow();
  });

  it("rejects fewer than two labels before calling the model", async () => {
    const { model, doDecide } = createMockDecisionModel({ choice: "only" });

    await expect(
      generateClassification({ model, labels: ["only"], prompt: "Hi" })
    ).rejects.toThrow("between 2 and 255 choices");
    expect(doDecide).not.toHaveBeenCalled();
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
  it("splits a template at its <data> block", async () => {
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
    const call = doDecide.mock.calls[0]![0];
    const state = stateText(call);
    expect(state.startsWith("<data>")).toBe(true);
    expect(state.endsWith("</data>")).toBe(true);
    expect(state).toContain("What is the capital of Australia?");
    expect(state).toContain("Sydney.");
    const instructions = call.questions.label!.instructions as string;
    expect(instructions).toContain("<rubric>");
    expect(instructions).toContain("Is the output correct or incorrect?");
    expect(instructions).not.toContain("<data>");
    expect(instructions).not.toContain("Sydney.");
  });

  it("does not split at a <data> tag that comes from a variable", async () => {
    const { model, doDecide } = createMockDecisionModel({ choice: "valid" });
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

    const result = await evaluator.evaluate({
      question: "what is <data>x</data>?",
    });

    expect(result).toMatchObject({ label: "valid", score: 1 });
    const call = doDecide.mock.calls[0]![0];
    expect(stateText(call)).toBe(
      "You judge questions.\n\nis the following question valid: what is <data>x</data>?"
    );
    expect(call.questions.label!.instructions).toBe(
      "Read the prompt in the state and answer it by selecting exactly one of the choices."
    );
  });
});

describe("isDecisionModel", () => {
  it("distinguishes decision models from language model ids and objects", () => {
    const { model } = createMockDecisionModel({ choice: "correct" });
    expect(isDecisionModel(model)).toBe(true);
    expect(isDecisionModel("gpt-4o-mini")).toBe(false);
  });
});

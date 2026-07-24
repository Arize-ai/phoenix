import { openai } from "@ai-sdk/openai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createQACorrectnessEvaluator } from "../../src/llm/createQACorrectnessEvaluator";
import * as generateClassificationModule from "../../src/llm/generateClassification";

describe("createQACorrectnessEvaluator", () => {
  beforeEach(() => {
    vi.stubEnv("OPENAI_API_KEY", "sk-dummy-test-key-12345");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  const model = openai("gpt-4o-mini");

  const record = {
    input: "What is the capital of France?",
    output: "The capital of France is Paris.",
    reference: "Paris is the capital and largest city of France.",
  };

  it("should create a Q&A correctness evaluator with default template and choices", async () => {
    const mockGenerateClassification = vi
      .spyOn(generateClassificationModule, "generateClassification")
      .mockResolvedValue({
        label: "correct",
        explanation: "The answer is supported by the reference.",
      });

    const evaluator = createQACorrectnessEvaluator({ model });

    const result = await evaluator.evaluate(record);

    expect(mockGenerateClassification).toHaveBeenCalledWith(
      expect.objectContaining({
        labels: ["correct", "incorrect"],
        prompt: expect.arrayContaining([
          expect.objectContaining({
            role: "user",
            content: expect.stringContaining(
              "whether an answer correctly and completely answers a question"
            ),
          }),
        ]),
      })
    );

    expect(result.label).toBe("correct");
    expect(result.score).toBe(1); // correct = 1 in default choices
    expect(result.explanation).toBe(
      "The answer is supported by the reference."
    );
  });

  it("should advertize the variables needed", () => {
    const qaCorrectness = createQACorrectnessEvaluator({ model });
    expect(qaCorrectness.promptTemplateVariables).toEqual([
      "input",
      "reference",
      "output",
    ]);
  });

  it("should use default optimization direction from config", () => {
    const evaluator = createQACorrectnessEvaluator({ model });
    expect(evaluator.optimizationDirection).toBe("MAXIMIZE");
  });

  it("should allow overriding optimization direction", () => {
    const evaluator = createQACorrectnessEvaluator({
      model,
      optimizationDirection: "MINIMIZE",
    });
    expect(evaluator.optimizationDirection).toBe("MINIMIZE");
  });

  it("should properly interpolate template variables", async () => {
    const mockGenerateClassification = vi
      .spyOn(generateClassificationModule, "generateClassification")
      .mockResolvedValue({
        label: "incorrect",
        explanation: "The answer contradicts the reference.",
      });

    const evaluator = createQACorrectnessEvaluator({ model });

    await evaluator.evaluate(record);

    for (const expected of [record.input, record.reference, record.output]) {
      expect(mockGenerateClassification).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.arrayContaining([
            expect.objectContaining({
              role: "user",
              content: expect.stringContaining(expected),
            }),
          ]),
        })
      );
    }
  });
});

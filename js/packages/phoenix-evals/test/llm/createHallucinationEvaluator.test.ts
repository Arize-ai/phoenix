import { openai } from "@ai-sdk/openai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createHallucinationEvaluator } from "../../src/llm/createHallucinationEvaluator";
import * as generateClassificationModule from "../../src/llm/generateClassification";

describe("createHallucinationEvaluator", () => {
  beforeEach(() => {
    vi.stubEnv("OPENAI_API_KEY", "sk-dummy-test-key-12345");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  const model = openai("gpt-4o-mini");

  const conversation =
    "User: What's our refund window?\n" +
    "Tool (lookup_policy): Refunds: 30 days from delivery.\n" +
    "Assistant: 30 days from delivery.";

  it("should create a hallucination evaluator with default template and choices", async () => {
    const mockGenerateClassification = vi
      .spyOn(generateClassificationModule, "generateClassification")
      .mockResolvedValue({
        label: "hallucinated",
        explanation: "The conversation does not support a 90-day window.",
      });

    const evaluator = createHallucinationEvaluator({ model });

    const result = await evaluator.evaluate({
      conversation,
      input: "And for electronics?",
      output: "Electronics can be returned within 90 days.",
    });

    expect(mockGenerateClassification).toHaveBeenCalledWith(
      expect.objectContaining({
        labels: ["hallucinated", "factual"],
        prompt: expect.arrayContaining([
          expect.objectContaining({
            role: "user",
            content: expect.stringContaining(
              "labeling whether an AI assistant's response contains hallucinations"
            ),
          }),
        ]),
      })
    );

    expect(result.label).toBe("hallucinated");
    expect(result.score).toBe(1); // hallucinated = 1 in default choices
    expect(result.explanation).toBe(
      "The conversation does not support a 90-day window."
    );
  });

  it("should advertize the variables needed", () => {
    const hallucination = createHallucinationEvaluator({ model });
    expect(hallucination.promptTemplateVariables).toEqual([
      "conversation",
      "input",
      "output",
    ]);
  });

  it("should use default optimization direction from config", () => {
    const evaluator = createHallucinationEvaluator({ model });
    expect(evaluator.optimizationDirection).toBe("MINIMIZE");
  });

  it("should allow overriding optimization direction", () => {
    const evaluator = createHallucinationEvaluator({
      model,
      optimizationDirection: "MAXIMIZE",
    });
    expect(evaluator.optimizationDirection).toBe("MAXIMIZE");
  });

  it("should properly interpolate template variables", async () => {
    const mockGenerateClassification = vi
      .spyOn(generateClassificationModule, "generateClassification")
      .mockResolvedValue({
        label: "factual",
        explanation: "Template variables correctly interpolated",
      });

    const evaluator = createHallucinationEvaluator({ model });

    const testInput = "And for electronics?";
    const testOutput = "Electronics are 14 days.";

    await evaluator.evaluate({
      conversation,
      input: testInput,
      output: testOutput,
    });

    for (const expected of [conversation, testInput, testOutput]) {
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

import { openai } from "@ai-sdk/openai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createRetrievalRelevanceEvaluator } from "../../src/llm/createRetrievalRelevanceEvaluator";
import * as generateClassificationModule from "../../src/llm/generateClassification";

describe("createRetrievalRelevanceEvaluator", () => {
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
    retrievedContext: "Paris is the capital and largest city of France.",
  };

  it("should create a retrieval relevance evaluator with default template and choices", async () => {
    const mockGenerateClassification = vi
      .spyOn(generateClassificationModule, "generateClassification")
      .mockResolvedValue({
        label: "relevant",
        explanation: "The retrieved information addresses the request.",
      });

    const evaluator = createRetrievalRelevanceEvaluator({ model });

    const result = await evaluator.evaluate(record);

    expect(mockGenerateClassification).toHaveBeenCalledWith(
      expect.objectContaining({
        labels: ["relevant", "irrelevant"],
        prompt: expect.arrayContaining([
          expect.objectContaining({
            role: "user",
            content: expect.stringContaining(
              "whether the external information retrieved during a single step is RELEVANT"
            ),
          }),
        ]),
      })
    );

    expect(result.label).toBe("relevant");
    expect(result.score).toBe(1); // relevant = 1 in default choices
    expect(result.explanation).toBe(
      "The retrieved information addresses the request."
    );
  });

  it("should advertize the variables needed", () => {
    const retrievalRelevance = createRetrievalRelevanceEvaluator({ model });
    expect(retrievalRelevance.promptTemplateVariables).toEqual([
      "input",
      "retrievedContext",
    ]);
  });

  it("should use default optimization direction from config", () => {
    const evaluator = createRetrievalRelevanceEvaluator({ model });
    expect(evaluator.optimizationDirection).toBe("MAXIMIZE");
  });

  it("should allow overriding optimization direction", () => {
    const evaluator = createRetrievalRelevanceEvaluator({
      model,
      optimizationDirection: "MINIMIZE",
    });
    expect(evaluator.optimizationDirection).toBe("MINIMIZE");
  });

  it("should properly interpolate template variables", async () => {
    const mockGenerateClassification = vi
      .spyOn(generateClassificationModule, "generateClassification")
      .mockResolvedValue({
        label: "irrelevant",
        explanation: "The retrieved information is off-topic.",
      });

    const evaluator = createRetrievalRelevanceEvaluator({ model });

    await evaluator.evaluate(record);

    for (const expected of [record.input, record.retrievedContext]) {
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

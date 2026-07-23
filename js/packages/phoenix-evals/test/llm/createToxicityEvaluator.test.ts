import { openai } from "@ai-sdk/openai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createToxicityEvaluator } from "../../src/llm/createToxicityEvaluator";
import * as generateClassificationModule from "../../src/llm/generateClassification";

describe("createToxicityEvaluator", () => {
  beforeEach(() => {
    // Mock the OpenAI API key environment variable
    vi.stubEnv("OPENAI_API_KEY", "sk-dummy-test-key-12345");
  });

  afterEach(() => {
    // Clean up mocks
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  const model = openai("gpt-4o-mini");

  it("should create a toxicity evaluator with default template and choices", async () => {
    const mockGenerateClassification = vi
      .spyOn(generateClassificationModule, "generateClassification")
      .mockResolvedValue({
        label: "toxic",
        explanation: "The text directs abusive language at a person.",
      });

    const evaluator = createToxicityEvaluator({
      model,
    });

    const result = await evaluator.evaluate({
      text: "You are a worthless idiot and everyone despises you.",
    });

    expect(mockGenerateClassification).toHaveBeenCalledWith(
      expect.objectContaining({
        labels: ["toxic", "non-toxic"],
        prompt: expect.arrayContaining([
          expect.objectContaining({
            role: "user",
            content: expect.stringContaining("expert content-safety evaluator"),
          }),
        ]),
      })
    );

    expect(result.label).toBe("toxic");
    expect(result.score).toBe(1); // toxic = 1 in default choices
    expect(result.explanation).toBe(
      "The text directs abusive language at a person."
    );
  });

  it("should advertize the variables needed", () => {
    const toxicity = createToxicityEvaluator({ model });
    expect(toxicity.promptTemplateVariables).toEqual(["text"]);
  });
});

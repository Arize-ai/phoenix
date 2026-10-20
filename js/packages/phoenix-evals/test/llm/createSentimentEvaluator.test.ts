import { openai } from "@ai-sdk/openai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createSentimentEvaluator } from "../../src/llm/createSentimentEvaluator";
import * as generateClassificationModule from "../../src/llm/generateClassification";

describe("createSentimentEvaluator", () => {
  beforeEach(() => vi.stubEnv("OPENAI_API_KEY", "sk-dummy-test-key"));
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  const model = openai("gpt-4o-mini");

  it("uses the default prompt, choices, and neutral direction", async () => {
    const generate = vi
      .spyOn(generateClassificationModule, "generateClassification")
      .mockResolvedValue({
        label: "negative",
        explanation: "The user expresses frustration.",
      });
    const evaluator = createSentimentEvaluator({ model });

    const result = await evaluator.evaluate({
      conversation:
        "User: My order still hasn't arrived.\nAssistant: Let me check.",
      userMessage: "This is the third time I've had to ask.",
    });

    expect(generate).toHaveBeenCalledWith(
      expect.objectContaining({
        labels: ["positive", "neutral", "negative"],
        prompt: expect.arrayContaining([
          expect.objectContaining({
            content: expect.stringContaining("sentiment the user expresses"),
          }),
        ]),
      })
    );
    expect(result.label).toBe("negative");
    expect(result.score).toBe(-1);
    expect(evaluator.optimizationDirection).toBe("NEUTRAL");
  });

  it("advertises the required variables", () => {
    const evaluator = createSentimentEvaluator({ model });
    expect(evaluator.promptTemplateVariables).toEqual([
      "conversation",
      "userMessage",
    ]);
  });

  it("allows overriding the prompt and choices", async () => {
    vi.spyOn(
      generateClassificationModule,
      "generateClassification"
    ).mockResolvedValue({ label: "yes", explanation: "Custom result" });
    const evaluator = createSentimentEvaluator({
      model,
      promptTemplate: "History: {{conversation}}\nLatest: {{userMessage}}",
      choices: { yes: 1, no: 0 },
    });

    const result = await evaluator.evaluate({
      conversation: "Assistant: Done.",
      userMessage: "This is perfect, thank you so much!",
    });
    expect(result.label).toBe("yes");
  });
});

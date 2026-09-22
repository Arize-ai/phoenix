import { openai } from "@ai-sdk/openai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createLanguageDetectionEvaluator } from "../../src/llm/createLanguageDetectionEvaluator";
import * as generateClassificationModule from "../../src/llm/generateClassification";

describe("createLanguageDetectionEvaluator", () => {
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
        label: "english",
        explanation: "The session is English throughout.",
      });
    const evaluator = createLanguageDetectionEvaluator({ model });

    const result = await evaluator.evaluate({
      session: "User: My deploy failed.\nAssistant: Raise the memory limit.",
    });

    expect(generate).toHaveBeenCalledWith(
      expect.objectContaining({
        labels: [
          "english",
          "mandarin_chinese",
          "hindi",
          "spanish",
          "french",
          "other",
        ],
        prompt: expect.arrayContaining([
          expect.objectContaining({
            content: expect.stringContaining("primary natural language"),
          }),
        ]),
      })
    );
    expect(result.label).toBe("english");
    expect(result.score).toBe(1);
    expect(result.explanation).toBe("The session is English throughout.");
    expect(evaluator.optimizationDirection).toBe("NEUTRAL");
  });

  it("advertises the required variables", () => {
    const evaluator = createLanguageDetectionEvaluator({ model });
    expect(evaluator.promptTemplateVariables).toEqual(["session"]);
  });

  it("allows overriding the prompt and choices", async () => {
    vi.spyOn(
      generateClassificationModule,
      "generateClassification"
    ).mockResolvedValue({ label: "yes", explanation: "Custom result" });
    const evaluator = createLanguageDetectionEvaluator({
      model,
      promptTemplate: "Session: {{session}}",
      choices: { yes: 1, no: 0 },
    });

    const result = await evaluator.evaluate({
      session: "User: Hola.\nAssistant: Buenos días.",
    });
    expect(result.label).toBe("yes");
    expect(result.score).toBe(1);
  });
});

import { openai } from "@ai-sdk/openai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createUserFrictionEvaluator } from "../../src/llm/createUserFrictionEvaluator";
import * as generateClassificationModule from "../../src/llm/generateClassification";

describe("createUserFrictionEvaluator", () => {
  beforeEach(() => vi.stubEnv("OPENAI_API_KEY", "sk-dummy-test-key"));
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  const model = openai("gpt-4o-mini");

  it("uses the default prompt, choices, and minimize direction", async () => {
    const generate = vi
      .spyOn(generateClassificationModule, "generateClassification")
      .mockResolvedValue({
        label: "friction",
        explanation: "The user corrects the assistant.",
      });
    const evaluator = createUserFrictionEvaluator({ model });

    const result = await evaluator.evaluate({
      conversation: "User: Show this week.\nAssistant: Here is last month.",
      userMessage: "No, I asked for this week.",
    });

    expect(generate).toHaveBeenCalledWith(
      expect.objectContaining({
        labels: ["friction", "no_friction"],
        prompt: expect.arrayContaining([
          expect.objectContaining({
            content: expect.stringContaining("expresses friction"),
          }),
        ]),
      })
    );
    expect(result.label).toBe("friction");
    expect(result.score).toBe(1);
    expect(evaluator.optimizationDirection).toBe("MINIMIZE");
  });

  it("advertises the required variables", () => {
    const evaluator = createUserFrictionEvaluator({ model });
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
    const evaluator = createUserFrictionEvaluator({
      model,
      promptTemplate: "History: {{conversation}}\nLatest: {{userMessage}}",
      choices: { yes: 1, no: 0 },
    });

    const result = await evaluator.evaluate({
      conversation: "Assistant: Done.",
      userMessage: "That's wrong.",
    });
    expect(result.label).toBe("yes");
  });
});

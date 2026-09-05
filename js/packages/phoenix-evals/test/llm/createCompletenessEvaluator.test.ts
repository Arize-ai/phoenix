import { openai } from "@ai-sdk/openai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createCompletenessEvaluator } from "../../src/llm/createCompletenessEvaluator";
import * as generateClassificationModule from "../../src/llm/generateClassification";

describe("createCompletenessEvaluator", () => {
  beforeEach(() => vi.stubEnv("OPENAI_API_KEY", "sk-dummy-test-key"));
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  const model = openai("gpt-4o-mini");

  it("uses the default prompt, choices, and maximize direction", async () => {
    const generate = vi
      .spyOn(generateClassificationModule, "generateClassification")
      .mockResolvedValue({
        label: "incomplete",
        explanation: "A secondary request was dropped.",
      });
    const evaluator = createCompletenessEvaluator({ model });

    const result = await evaluator.evaluate({
      conversation:
        "User: Reset my password and update billing.\nAssistant: Password reset.",
    });

    expect(generate).toHaveBeenCalledWith(
      expect.objectContaining({
        labels: ["complete", "incomplete"],
        prompt: expect.arrayContaining([
          expect.objectContaining({
            content: expect.stringContaining("every active request"),
          }),
        ]),
      })
    );
    expect(result.label).toBe("incomplete");
    expect(result.score).toBe(0);
    expect(evaluator.optimizationDirection).toBe("MAXIMIZE");
  });

  it("advertises the required variables", () => {
    const evaluator = createCompletenessEvaluator({ model });
    expect(evaluator.promptTemplateVariables).toEqual(["conversation"]);
  });

  it("allows overriding the prompt and choices", async () => {
    vi.spyOn(
      generateClassificationModule,
      "generateClassification"
    ).mockResolvedValue({ label: "yes", explanation: "Custom result" });
    const evaluator = createCompletenessEvaluator({
      model,
      promptTemplate: "Conversation: {{conversation}}\nIs it complete?",
      choices: { yes: 1, no: 0 },
    });

    const result = await evaluator.evaluate({
      conversation: "User: Hi.\nAssistant: Hello.",
    });
    expect(result.label).toBe("yes");
  });
});

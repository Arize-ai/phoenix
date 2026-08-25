import { openai } from "@ai-sdk/openai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createPiiDetectionEvaluator } from "../../src/llm/createPiiDetectionEvaluator";
import * as generateClassificationModule from "../../src/llm/generateClassification";

describe("createPiiDetectionEvaluator", () => {
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
        label: "pii_detected",
        explanation:
          'FINDINGS:\n- type: email_address | source: user_message | value: "jane.doe@acme.com"',
      });
    const evaluator = createPiiDetectionEvaluator({ model });

    const result = await evaluator.evaluate({
      conversation:
        "User: Reset my account.\nAssistant: What email is on the account?\nUser: jane.doe@acme.com",
    });

    expect(generate).toHaveBeenCalledWith(
      expect.objectContaining({
        labels: ["pii_detected", "no_pii_detected"],
        prompt: expect.arrayContaining([
          expect.objectContaining({
            content: expect.stringContaining(
              "personally identifiable information"
            ),
          }),
        ]),
      })
    );
    expect(result.label).toBe("pii_detected");
    expect(result.score).toBe(1);
    expect(evaluator.optimizationDirection).toBe("MINIMIZE");
  });

  it("advertises the required variables", () => {
    const evaluator = createPiiDetectionEvaluator({ model });
    expect(evaluator.promptTemplateVariables).toEqual(["conversation"]);
  });

  it("allows overriding the prompt and choices", async () => {
    vi.spyOn(
      generateClassificationModule,
      "generateClassification"
    ).mockResolvedValue({ label: "yes", explanation: "Custom result" });
    const evaluator = createPiiDetectionEvaluator({
      model,
      promptTemplate: "Record: {{conversation}}\nDoes this contain PII?",
      choices: { yes: 1, no: 0 },
    });

    const result = await evaluator.evaluate({
      conversation: "User: jane.doe@acme.com",
    });
    expect(result.label).toBe("yes");
    expect(result.score).toBe(1);
  });
});

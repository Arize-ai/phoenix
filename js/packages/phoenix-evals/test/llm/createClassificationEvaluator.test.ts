import { createClassificationEvaluator } from "../../src";

import { MockLanguageModelV2 } from "ai/test";
import { describe, expect, expectTypeOf, it, vi } from "vitest";
describe("createClassificationEvaluator", () => {
  it("should support the passed in type signature", () => {
    const evaluator = createClassificationEvaluator<{ question: string }>({
      name: "isValid",
      model: new MockLanguageModelV2({
        doGenerate: async () => ({
          finishReason: "stop",
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          content: [{ type: "text", text: "valid" }],
          warnings: [],
        }),
      }),
      promptTemplate: "is the following question valid: {{question}}",
      choices: { valid: 1, invalid: 0 },
    });
    expectTypeOf(evaluator.evaluate)
      .parameter(0)
      .toMatchObjectType<{ question: string }>();
  });
  it("should have the correct prompt template variables", () => {
    const evaluator = createClassificationEvaluator<{ question: string }>({
      name: "isValid",
      model: new MockLanguageModelV2({
        doGenerate: async () => ({
          finishReason: "stop",
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          content: [{ type: "text", text: "valid" }],
          warnings: [],
        }),
      }),
      promptTemplate: "is the following question valid: {{question}}",
      choices: { valid: 1, invalid: 0 },
    });
    expect(evaluator.promptTemplateVariables).toEqual(["question"]);
  });
  it("should support message templates", async () => {
    const evaluator = createClassificationEvaluator<{ question: string }>({
      name: "isValid",
      model: new MockLanguageModelV2({
        doGenerate: async () => ({
          finishReason: "stop",
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          content: [
            {
              type: "text",
              text: '{"label": "valid", "explanation": "The question is valid"}',
            },
          ],
          warnings: [],
        }),
      }),
      promptTemplate: [
        {
          role: "user",
          content: "is the following question valid: {{question}}",
        },
      ],
      choices: { valid: 1, invalid: 0 },
    });
    expect(evaluator.promptTemplateVariables).toEqual(["question"]);
    const result = await evaluator.evaluate({
      question: "Is this a valid question?",
    });
    expect(result.label).toBe("valid");
    expect(result.score).toBe(1);
    expect(result.explanation).toBe("The question is valid");
  });
  it("should apply template varibables across messages", async () => {
    const doGenerate = vi.fn().mockResolvedValue({
      finishReason: "stop",
      usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      content: [
        {
          type: "text",
          text: '{"label": "valid", "explanation": "The question is valid"}',
        },
      ],
      warnings: [],
    });
    const mockModel = new MockLanguageModelV2({ doGenerate });

    const evaluator = createClassificationEvaluator<{ question: string }>({
      name: "isValid",
      model: mockModel,
      promptTemplate: [
        {
          role: "system",
          content: "You are and expert in evaluating questions.",
        },
        {
          role: "user",
          content: "is the following question valid: {{question}}",
        },
      ],
      choices: { valid: 1, invalid: 0 },
    });
    expect(evaluator.promptTemplateVariables).toEqual(["question"]);
    const result = await evaluator.evaluate({
      question: "Is this a valid question?",
    });
    expect(result.label).toBe("valid");
    expect(result.score).toBe(1);
    expect(result.explanation).toBe("The question is valid");

    // Ensure all template variables are substituted in every message
    const calledWith = doGenerate.mock.calls[0][0];
    // Check that the prompt is an array (chat template)
    expect(Array.isArray(calledWith.prompt)).toBe(true);
    // Find the user message
    const userMsg = calledWith.prompt.find((msg) => msg.role === "user");
    expect(userMsg).toBeDefined();
    expect(userMsg.content).toEqual([
      {
        type: "text",
        text: "is the following question valid: Is this a valid question?",
      },
    ]);
  });
});

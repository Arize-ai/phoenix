import { createClassificationEvaluator } from "@arizeai/phoenix-evals";

import { getExperimentEvaluators } from "../../../src/experiments/helpers/getExperimentEvaluators";
import { Evaluator } from "../../../src/types/experiments";

import { MockLanguageModelV2 } from "ai/test";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the fromPhoenixEvaluator function
vi.mock("../../../src/experiments/helpers/fromPhoenixEvaluator");

const mockFromPhoenixEvaluator = vi.fn();

describe("getExperimentEvaluators", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mockFromPhoenixEvaluator.mockClear();
    // Set up the mock implementation
    const { fromPhoenixEvaluator } = await import(
      "../../../src/experiments/helpers/fromPhoenixLLMEvaluator"
    );
    vi.mocked(fromPhoenixEvaluator).mockImplementation(
      mockFromPhoenixEvaluator
    );
  });

  describe("ClassificationEvaluator handling", () => {
    it("should convert a valid ClassificationEvaluator", () => {
      const classificationEvaluator = createClassificationEvaluator({
        name: "test-classifier",
        model: new MockLanguageModelV2({
          doGenerate: async () => ({
            finishReason: "stop",
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            content: [
              {
                type: "text",
                text: `{"label": "good", "explanation": "test explanation"}`,
              },
            ],
            warnings: [],
          }),
        }),
        promptTemplate: "Evaluate this: {{output}}",
        choices: { good: 1, bad: 0 },
      });

      const mockConvertedEvaluator: Evaluator = {
        name: "test-classifier",
        kind: "LLM",
        evaluate: vi.fn().mockResolvedValue({ score: 1, label: "good" }),
      };

      mockFromPhoenixEvaluator.mockReturnValue(mockConvertedEvaluator);

      const result = getExperimentEvaluators([classificationEvaluator]);

      expect(mockFromPhoenixEvaluator).toHaveBeenCalledWith(
        classificationEvaluator
      );
      expect(result).toEqual([mockConvertedEvaluator]);
    });

    it("should handle multiple ClassificationEvaluators", () => {
      const evaluator1 = createClassificationEvaluator({
        name: "evaluator-1",
        model: new MockLanguageModelV2({
          doGenerate: async () => ({
            finishReason: "stop",
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            content: [
              {
                type: "text",
                text: `{"label": "correct", "explanation": "test"}`,
              },
            ],
            warnings: [],
          }),
        }),
        promptTemplate: "Evaluate: {{output}}",
        choices: { correct: 1, incorrect: 0 },
      });

      const evaluator2 = createClassificationEvaluator({
        name: "evaluator-2",
        model: new MockLanguageModelV2({
          doGenerate: async () => ({
            finishReason: "stop",
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            content: [
              {
                type: "text",
                text: `{"label": "relevant", "explanation": "test"}`,
              },
            ],
            warnings: [],
          }),
        }),
        promptTemplate: "Is this relevant: {{output}}",
        choices: { relevant: 1, irrelevant: 0 },
      });

      const mockConverted1: Evaluator = {
        name: "evaluator-1",
        kind: "LLM",
        evaluate: vi.fn(),
      };

      const mockConverted2: Evaluator = {
        name: "evaluator-2",
        kind: "LLM",
        evaluate: vi.fn(),
      };

      mockFromPhoenixEvaluator
        .mockReturnValueOnce(mockConverted1)
        .mockReturnValueOnce(mockConverted2);

      const result = getExperimentEvaluators([evaluator1, evaluator2]);

      expect(mockFromPhoenixEvaluator).toHaveBeenCalledTimes(2);
      expect(mockFromPhoenixEvaluator).toHaveBeenNthCalledWith(1, evaluator1);
      expect(mockFromPhoenixEvaluator).toHaveBeenNthCalledWith(2, evaluator2);
      expect(result).toEqual([mockConverted1, mockConverted2]);
    });
  });

  describe("Evaluator handling", () => {
    it("should pass through a valid Evaluator unchanged", () => {
      const mockEvaluator: Evaluator = {
        name: "test-evaluator",
        kind: "CODE",
        evaluate: async ({ input: _input, output: _output }) => ({
          score: 1.0,
          label: "pass",
        }),
      };

      const result = getExperimentEvaluators([mockEvaluator]);

      expect(mockFromPhoenixEvaluator).not.toHaveBeenCalled();
      expect(result).toEqual([mockEvaluator]);
    });

    it("should handle multiple Evaluators", () => {
      const evaluator1: Evaluator = {
        name: "evaluator-1",
        kind: "CODE",
        evaluate: vi.fn(),
      };

      const evaluator2: Evaluator = {
        name: "evaluator-2",
        kind: "HUMAN",
        evaluate: vi.fn(),
      };

      const result = getExperimentEvaluators([evaluator1, evaluator2]);

      expect(mockFromPhoenixEvaluator).not.toHaveBeenCalled();
      expect(result).toEqual([evaluator1, evaluator2]);
    });
  });

  describe("Mixed evaluator types", () => {
    it("should handle a mix of ClassificationEvaluator and Evaluator", () => {
      const classificationEvaluator = createClassificationEvaluator({
        name: "classification-eval",
        model: new MockLanguageModelV2({
          doGenerate: async () => ({
            finishReason: "stop",
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            content: [
              {
                type: "text",
                text: `{"label": "good", "explanation": "test"}`,
              },
            ],
            warnings: [],
          }),
        }),
        promptTemplate: "Classify: {{output}}",
        choices: { good: 1, bad: 0 },
      });

      const experimentEvaluator: Evaluator = {
        name: "experiment-eval",
        kind: "CODE",
        evaluate: vi.fn(),
      };

      const mockConvertedEvaluator: Evaluator = {
        name: "classification-eval",
        kind: "LLM",
        evaluate: vi.fn(),
      };

      mockFromPhoenixEvaluator.mockReturnValue(mockConvertedEvaluator);

      const result = getExperimentEvaluators([
        classificationEvaluator,
        experimentEvaluator,
      ]);

      expect(mockFromPhoenixEvaluator).toHaveBeenCalledWith(
        classificationEvaluator
      );
      expect(result).toEqual([mockConvertedEvaluator, experimentEvaluator]);
    });
  });

  describe("Error handling", () => {
    it("should throw an error for unsupported evaluator types", () => {
      const unsupportedEvaluator = {
        name: "unsupported",
        // Missing required properties
      };

      expect(() => getExperimentEvaluators([unsupportedEvaluator])).toThrow(
        `Unsupported evaluator: ${JSON.stringify(unsupportedEvaluator)}`
      );
    });

    it("should throw an error for null evaluator", () => {
      expect(() => getExperimentEvaluators([null])).toThrow(
        "Unsupported evaluator: null"
      );
    });

    it("should throw an error for undefined evaluator", () => {
      expect(() => getExperimentEvaluators([undefined])).toThrow(
        "Unsupported evaluator: undefined"
      );
    });

    it("should throw an error for primitive types", () => {
      expect(() => getExperimentEvaluators(["string"])).toThrow(
        'Unsupported evaluator: "string"'
      );

      expect(() => getExperimentEvaluators([123])).toThrow(
        "Unsupported evaluator: 123"
      );

      expect(() => getExperimentEvaluators([true])).toThrow(
        "Unsupported evaluator: true"
      );
    });

    it("should throw an error for objects missing required properties", () => {
      const invalidEvaluator1 = {
        name: "test",
        // Missing evaluate, kind
      };

      const invalidEvaluator2 = {
        evaluate: vi.fn(),
        // Missing name, kind
      };

      const invalidEvaluator3 = {
        name: "test",
        evaluate: vi.fn(),
        // Missing kind
      };

      expect(() => getExperimentEvaluators([invalidEvaluator1])).toThrow(
        `Unsupported evaluator: ${JSON.stringify(invalidEvaluator1)}`
      );

      expect(() => getExperimentEvaluators([invalidEvaluator2])).toThrow(
        `Unsupported evaluator: ${JSON.stringify(invalidEvaluator2)}`
      );

      expect(() => getExperimentEvaluators([invalidEvaluator3])).toThrow(
        `Unsupported evaluator: ${JSON.stringify(invalidEvaluator3)}`
      );
    });

    it("should treat object with CODE kind as Evaluator, not ClassificationEvaluator", () => {
      const evaluatorWithCodeKind = {
        name: "test-classifier",
        kind: "CODE", // This makes it an Evaluator, not a ClassificationEvaluator
        evaluate: vi.fn(),
      };

      const result = getExperimentEvaluators([evaluatorWithCodeKind]);

      // Should not call fromPhoenixEvaluator since it's treated as an Evaluator
      expect(mockFromPhoenixEvaluator).not.toHaveBeenCalled();
      expect(result).toEqual([evaluatorWithCodeKind]);
    });
  });

  describe("Edge cases", () => {
    it("should handle empty array", () => {
      const result = getExperimentEvaluators([]);
      expect(result).toEqual([]);
      expect(mockFromPhoenixEvaluator).not.toHaveBeenCalled();
    });

    it("should handle evaluator with extra properties", () => {
      const evaluatorWithExtras: Evaluator & { extraProp: string } = {
        name: "test-evaluator",
        kind: "CODE",
        evaluate: vi.fn(),
        extraProp: "extra",
      };

      const result = getExperimentEvaluators([evaluatorWithExtras]);

      expect(result).toEqual([evaluatorWithExtras]);
    });

    it("should handle ClassificationEvaluator with extra properties", () => {
      const classificationEvaluator = createClassificationEvaluator({
        name: "test-classifier",
        model: new MockLanguageModelV2({
          doGenerate: async () => ({
            finishReason: "stop",
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            content: [
              {
                type: "text",
                text: `{"label": "pass", "explanation": "test"}`,
              },
            ],
            warnings: [],
          }),
        }),
        promptTemplate: "Test: {{output}}",
        choices: { pass: 1, fail: 0 },
      });

      // Add extra property to the evaluator object
      const classificationEvaluatorWithExtras = {
        ...classificationEvaluator,
        extraProp: "extra",
      };

      const mockConvertedEvaluator: Evaluator = {
        name: "test-classifier",
        kind: "LLM",
        evaluate: vi.fn(),
      };

      mockFromPhoenixEvaluator.mockReturnValue(mockConvertedEvaluator);

      const result = getExperimentEvaluators([
        classificationEvaluatorWithExtras,
      ]);

      expect(mockFromPhoenixEvaluator).toHaveBeenCalledWith(
        classificationEvaluatorWithExtras
      );
      expect(result).toEqual([mockConvertedEvaluator]);
    });
  });

  describe("Type guard validation", () => {
    it("should correctly identify ClassificationEvaluator vs Evaluator", () => {
      // This tests the type guard logic indirectly
      const classificationEvaluator = createClassificationEvaluator({
        name: "classification-eval",
        model: new MockLanguageModelV2({
          doGenerate: async () => ({
            finishReason: "stop",
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            content: [
              {
                type: "text",
                text: `{"label": "valid", "explanation": "test"}`,
              },
            ],
            warnings: [],
          }),
        }),
        promptTemplate: "Validate: {{output}}",
        choices: { valid: 1, invalid: 0 },
      });

      const codeEvaluator: Evaluator = {
        name: "code-eval",
        kind: "CODE", // Different kind should make it not a ClassificationEvaluator
        evaluate: vi.fn(),
      };

      const llmEvaluator: Evaluator = {
        name: "llm-eval",
        kind: "HUMAN", // Different kind to avoid confusion with ClassificationEvaluator
        evaluate: vi.fn(),
      };

      const mockConvertedEvaluator: Evaluator = {
        name: "classification-eval",
        kind: "LLM",
        evaluate: vi.fn(),
      };

      mockFromPhoenixEvaluator.mockReturnValue(mockConvertedEvaluator);

      const result = getExperimentEvaluators([
        classificationEvaluator,
        codeEvaluator,
        llmEvaluator,
      ]);

      // Only the ClassificationEvaluator should be converted
      expect(mockFromPhoenixEvaluator).toHaveBeenCalledTimes(1);
      expect(mockFromPhoenixEvaluator).toHaveBeenCalledWith(
        classificationEvaluator
      );
      expect(result).toEqual([
        mockConvertedEvaluator,
        codeEvaluator,
        llmEvaluator,
      ]);
    });
  });
});

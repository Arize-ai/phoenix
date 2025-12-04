import { createClassificationEvaluator } from "../../src";
import { ObjectMapping } from "../../src/types/data";
import { bindEvaluator } from "../../src/utils/bindEvaluator";

import { MockLanguageModelV2 } from "ai/test";
import { describe, expect, it } from "vitest";

// Helper function to create a classification evaluator for testing
function createTestEvaluator<RecordType extends Record<string, unknown>>(
  name: string,
  inputMapping?: ObjectMapping<RecordType>
) {
  return createClassificationEvaluator<RecordType>({
    name,
    model: new MockLanguageModelV2({
      doGenerate: async () => ({
        finishReason: "stop",
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        content: [{ type: "text", text: "valid" }],
        warnings: [],
      }),
    }),
    promptTemplate: "Evaluate the input",
    choices: { valid: 1, invalid: 0 },
    inputMapping,
  });
}

describe("bindEvaluator", () => {
  describe("basic functionality", () => {
    it("should bind input mapping to an evaluator using context", () => {
      const evaluator = createTestEvaluator("test-evaluator");
      const context = {
        inputMapping: {
          userName: "name",
          userAge: "age",
        },
      };

      const boundEvaluator = bindEvaluator(evaluator, context);

      expect(boundEvaluator.inputMapping).toEqual(context.inputMapping);
      expect(boundEvaluator.name).toBe("test-evaluator");
    });

    it("should return a new evaluator instance when binding", () => {
      const evaluator = createTestEvaluator("test-evaluator");
      const context = {
        inputMapping: {
          userName: "name",
        },
      };

      const boundEvaluator = bindEvaluator(evaluator, context);

      expect(boundEvaluator).not.toBe(evaluator);
      expect(boundEvaluator.inputMapping).toEqual(context.inputMapping);
      expect(evaluator.inputMapping).toBeUndefined();
    });

    it("should preserve evaluator properties", () => {
      const evaluator = createTestEvaluator("test-evaluator");
      const context = {
        inputMapping: {
          extractedData: "data",
        },
      };

      const boundEvaluator = bindEvaluator(evaluator, context);

      expect(boundEvaluator.name).toBe(evaluator.name);
      expect(boundEvaluator.kind).toBe(evaluator.kind);
      expect(boundEvaluator.optimizationDirection).toBe(
        evaluator.optimizationDirection
      );
    });
  });
});

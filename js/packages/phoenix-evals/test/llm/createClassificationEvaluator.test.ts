import { createClassificationEvaluator } from "../../src";

import { openai } from "@ai-sdk/openai";
import { describe, expectTypeOf, it } from "vitest";
describe("createClassificationEvaluator", () => {
  it("should support the passed in type signature", () => {
    const evaluator = createClassificationEvaluator<{ question: string }>({
      name: "isValid",
      model: openai("gpt-4o"),
      promptTemplate: "is the following question valid: {{question}}",
      choices: { valid: 1, invalid: 0 },
    });
    expectTypeOf(evaluator.evaluate)
      .parameter(0)
      .toMatchObjectType<{ question: string }>();
  });
});

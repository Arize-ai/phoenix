import { createFaithfulnessEvaluator } from "../../src/llm/createFaithfulnessEvaluator";
import * as generateClassificationModule from "../../src/llm/generateClassification";

import { openai } from "@ai-sdk/openai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("createFaithfulnessEvaluator", () => {
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

  const customFaithfulnessTemplate = `
Custom template for faithfulness detection:
Query: {{input}}
Reference: {{reference}}
Answer: {{output}}
Is the answer faithful? Respond with "yes" or "no".
`;

  it("should create a faithfulness evaluator with default template and choices", async () => {
    // Mock the generateClassification function
    const mockGenerateClassification = vi
      .spyOn(generateClassificationModule, "generateClassification")
      .mockResolvedValue({
        label: "faithful",
        explanation: "The answer is based on the reference text",
      });

    const evaluator = createFaithfulnessEvaluator({
      model,
    });

    const result = await evaluator.evaluate({
      output: "Arize Phoenix is open source.",
      input: "Is Arize Phoenix Open Source?",
      context:
        "Arize Phoenix is a platform for building and deploying AI applications. It is open source.",
    });

    // Verify the function was called with default template and choices
    expect(mockGenerateClassification).toHaveBeenCalledWith(
      expect.objectContaining({
        labels: ["faithful", "unfaithful"],
        prompt: expect.arrayContaining([
          expect.objectContaining({
            role: "user",
            content: expect.stringContaining(
              "In this task, you will be presented with a query"
            ),
          }),
        ]),
      })
    );

    expect(result.label).toBe("faithful");
    expect(result.score).toBe(1); // faithful = 1 in default choices
    expect(result.explanation).toBe(
      "The answer is based on the reference text"
    );
  });

  it("should advertize the variables needed", () => {
    const faithfulness = createFaithfulnessEvaluator({ model });
    expect(faithfulness.promptTemplateVariables).toEqual([
      "input",
      "context",
      "output",
    ]);
  });

  it("should use default optimization direction from config", () => {
    const evaluator = createFaithfulnessEvaluator({ model });
    expect(evaluator.optimizationDirection).toBe("MAXIMIZE");
  });

  it("should allow overriding optimization direction", () => {
    const evaluator = createFaithfulnessEvaluator({
      model,
      optimizationDirection: "MINIMIZE",
    });
    expect(evaluator.optimizationDirection).toBe("MINIMIZE");
  });

  it("should support custom template", async () => {
    // Mock the generateClassification function
    const mockGenerateClassification = vi
      .spyOn(generateClassificationModule, "generateClassification")
      .mockResolvedValue({
        label: "no",
        explanation: "The answer contains unfaithful information",
      });

    const evaluator = createFaithfulnessEvaluator({
      model,
      promptTemplate: customFaithfulnessTemplate,
      choices: { yes: 1, no: 0 }, // Custom choices for custom template
    });

    const result = await evaluator.evaluate({
      output: "Arize Phoenix costs $1000 per month.",
      input: "How much does Arize Phoenix cost?",
      reference:
        "Arize Phoenix is a platform for building and deploying AI applications. It is open source.",
    });

    // Verify the function was called with custom template
    expect(mockGenerateClassification).toHaveBeenCalledWith(
      expect.objectContaining({
        labels: ["yes", "no"],
        prompt: expect.stringContaining(
          "Custom template for faithfulness detection"
        ),
      })
    );

    expect(result.label).toBe("no");
    expect(result.score).toBe(0); // no = 0 in custom choices
  });

  it("should support custom choices with default template", async () => {
    // Mock the generateClassification function
    vi.spyOn(
      generateClassificationModule,
      "generateClassification"
    ).mockResolvedValue({
      label: "unfaithful",
      explanation: "The answer contradicts the reference text",
    });

    const customChoices = { faithful: 0.8, unfaithful: 0.2 };

    const evaluator = createFaithfulnessEvaluator({
      model,
      choices: customChoices,
    });

    const result = await evaluator.evaluate({
      output: "Arize Phoenix is not open source.",
      input: "Is Arize Phoenix Open Source?",
      context:
        "Arize Phoenix is a platform for building and deploying AI applications. It is open source.",
    });

    expect(result.label).toBe("unfaithful");
    expect(result.score).toBe(0.2); // Custom score for unfaithful
  });

  it("should have telemetry enabled by default", async () => {
    // Mock the generateClassification function to spy on telemetry configuration
    const mockGenerateClassification = vi
      .spyOn(generateClassificationModule, "generateClassification")
      .mockResolvedValue({
        label: "faithful",
        explanation: "This is a test explanation",
      });

    const evaluator = createFaithfulnessEvaluator({
      model,
      // Note: we're not explicitly setting telemetry options here
    });

    await evaluator.evaluate({
      output: "Arize Phoenix is open source.",
      input: "Is Arize Phoenix Open Source?",
      context:
        "Arize Phoenix is a platform for building and deploying AI applications. It is open source.",
    });

    // Verify that generateClassification was called without telemetry property (defaults to enabled)
    expect(mockGenerateClassification).toHaveBeenCalledWith(
      expect.not.objectContaining({
        telemetry: expect.anything(),
      })
    );
  });

  it("should respect explicitly disabled telemetry", async () => {
    // Mock the generateClassification function to spy on telemetry configuration
    const mockGenerateClassification = vi
      .spyOn(generateClassificationModule, "generateClassification")
      .mockResolvedValue({
        label: "faithful",
        explanation: "This is a test explanation",
      });

    const evaluator = createFaithfulnessEvaluator({
      model,
      telemetry: { isEnabled: false }, // Explicitly disable telemetry
    });

    await evaluator.evaluate({
      output: "Arize Phoenix is open source.",
      input: "Is Arize Phoenix Open Source?",
      context:
        "Arize Phoenix is a platform for building and deploying AI applications. It is open source.",
    });

    // Verify that generateClassification was called with telemetry disabled
    expect(mockGenerateClassification).toHaveBeenCalledWith(
      expect.objectContaining({
        telemetry: { isEnabled: false },
      })
    );
  });

  it("should support custom tracer in telemetry configuration", async () => {
    // Mock the generateClassification function
    const mockGenerateClassification = vi
      .spyOn(generateClassificationModule, "generateClassification")
      .mockResolvedValue({
        label: "faithful",
        explanation: "This is a test explanation",
      });

    const customTracer = {} as import("@opentelemetry/api").Tracer; // Mock tracer object

    const evaluator = createFaithfulnessEvaluator({
      model,
      telemetry: {
        isEnabled: true,
        tracer: customTracer,
      },
    });

    await evaluator.evaluate({
      output: "Arize Phoenix is open source.",
      input: "Is Arize Phoenix Open Source?",
      context:
        "Arize Phoenix is a platform for building and deploying AI applications. It is open source.",
    });

    // Verify that generateClassification was called with custom tracer
    expect(mockGenerateClassification).toHaveBeenCalledWith(
      expect.objectContaining({
        telemetry: {
          isEnabled: true,
          tracer: customTracer,
        },
      })
    );
  });

  it("should properly interpolate template variables", async () => {
    // Mock the generateClassification function
    const mockGenerateClassification = vi
      .spyOn(generateClassificationModule, "generateClassification")
      .mockResolvedValue({
        label: "faithful",
        explanation: "Template variables correctly interpolated",
      });

    const evaluator = createFaithfulnessEvaluator({
      model,
    });

    const testInput = "What is the capital of France?";
    const testOutput = "The capital of France is Paris.";
    const testContext = "Paris is the capital and largest city of France.";

    await evaluator.evaluate({
      output: testOutput,
      input: testInput,
      context: testContext,
    });

    // Verify that the prompt contains the interpolated values
    expect(mockGenerateClassification).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.arrayContaining([
          expect.objectContaining({
            role: "user",
            content: expect.stringContaining(testInput),
          }),
        ]),
      })
    );
    expect(mockGenerateClassification).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.arrayContaining([
          expect.objectContaining({
            role: "user",
            content: expect.stringContaining(testOutput),
          }),
        ]),
      })
    );
    expect(mockGenerateClassification).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.arrayContaining([
          expect.objectContaining({
            role: "user",
            content: expect.stringContaining(testContext),
          }),
        ]),
      })
    );
  });
});

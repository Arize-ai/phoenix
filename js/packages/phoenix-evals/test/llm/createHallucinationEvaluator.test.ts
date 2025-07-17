import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { createHallucinationEvaluator } from "../../src/llm/createHallucinationEvaluator";
import { openai } from "@ai-sdk/openai";
import * as generateClassificationModule from "../../src/llm/generateClassification";

describe("createHallucinationEvaluator", () => {
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

  const customHallucinationTemplate = `
Custom template for hallucination detection:
Query: {{input}}
Reference: {{reference}}
Answer: {{output}}
Is the answer hallucinated? Respond with "yes" or "no".
`;

  it("should create a hallucination evaluator with default template and choices", async () => {
    // Mock the generateClassification function
    const mockGenerateClassification = vi
      .spyOn(generateClassificationModule, "generateClassification")
      .mockResolvedValue({
        label: "factual",
        explanation: "The answer is based on the reference text",
      });

    const evaluator = createHallucinationEvaluator({
      model,
    });

    const result = await evaluator({
      output: "Arize Phoenix is open source.",
      input: "Is Arize Phoenix Open Source?",
      reference:
        "Arize Phoenix is a platform for building and deploying AI applications. It is open source.",
    });

    // Verify the function was called with default template and choices
    expect(mockGenerateClassification).toHaveBeenCalledWith(
      expect.objectContaining({
        labels: ["factual", "hallucinated"],
        prompt: expect.stringContaining(
          "In this task, you will be presented with a query"
        ),
      })
    );

    expect(result.label).toBe("factual");
    expect(result.score).toBe(1); // factual = 1 in default choices
    expect(result.explanation).toBe(
      "The answer is based on the reference text"
    );
  });

  it("should support custom template", async () => {
    // Mock the generateClassification function
    const mockGenerateClassification = vi
      .spyOn(generateClassificationModule, "generateClassification")
      .mockResolvedValue({
        label: "yes",
        explanation: "The answer contains hallucinated information",
      });

    const evaluator = createHallucinationEvaluator({
      model,
      promptTemplate: customHallucinationTemplate,
      choices: { yes: 0, no: 1 }, // Custom choices for custom template
    });

    const result = await evaluator({
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
          "Custom template for hallucination detection"
        ),
      })
    );

    expect(result.label).toBe("yes");
    expect(result.score).toBe(0); // yes = 0 in custom choices
  });

  it("should support custom choices with default template", async () => {
    // Mock the generateClassification function
    vi.spyOn(
      generateClassificationModule,
      "generateClassification"
    ).mockResolvedValue({
      label: "hallucinated",
      explanation: "The answer contradicts the reference text",
    });

    const customChoices = { factual: 0.8, hallucinated: 0.2 };

    const evaluator = createHallucinationEvaluator({
      model,
      choices: customChoices,
    });

    const result = await evaluator({
      output: "Arize Phoenix is not open source.",
      input: "Is Arize Phoenix Open Source?",
      reference:
        "Arize Phoenix is a platform for building and deploying AI applications. It is open source.",
    });

    expect(result.label).toBe("hallucinated");
    expect(result.score).toBe(0.2); // Custom score for hallucinated
  });

  it("should have telemetry enabled by default", async () => {
    // Mock the generateClassification function to spy on telemetry configuration
    const mockGenerateClassification = vi
      .spyOn(generateClassificationModule, "generateClassification")
      .mockResolvedValue({
        label: "factual",
        explanation: "This is a test explanation",
      });

    const evaluator = createHallucinationEvaluator({
      model,
      // Note: we're not explicitly setting telemetry options here
    });

    await evaluator({
      output: "Arize Phoenix is open source.",
      input: "Is Arize Phoenix Open Source?",
      reference:
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
        label: "factual",
        explanation: "This is a test explanation",
      });

    const evaluator = createHallucinationEvaluator({
      model,
      telemetry: { isEnabled: false }, // Explicitly disable telemetry
    });

    await evaluator({
      output: "Arize Phoenix is open source.",
      input: "Is Arize Phoenix Open Source?",
      reference:
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
        label: "factual",
        explanation: "This is a test explanation",
      });

    const customTracer = {} as import("@opentelemetry/api").Tracer; // Mock tracer object

    const evaluator = createHallucinationEvaluator({
      model,
      telemetry: {
        isEnabled: true,
        tracer: customTracer,
      },
    });

    await evaluator({
      output: "Arize Phoenix is open source.",
      input: "Is Arize Phoenix Open Source?",
      reference:
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
        label: "factual",
        explanation: "Template variables correctly interpolated",
      });

    const evaluator = createHallucinationEvaluator({
      model,
    });

    const testInput = "What is the capital of France?";
    const testOutput = "The capital of France is Paris.";
    const testReference = "Paris is the capital and largest city of France.";

    await evaluator({
      output: testOutput,
      input: testInput,
      reference: testReference,
    });

    // Verify that the prompt contains the interpolated values
    expect(mockGenerateClassification).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining(testInput),
      })
    );
    expect(mockGenerateClassification).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining(testOutput),
      })
    );
    expect(mockGenerateClassification).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining(testReference),
      })
    );
  });
});

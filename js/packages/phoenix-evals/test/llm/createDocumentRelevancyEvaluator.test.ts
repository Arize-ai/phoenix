import { createDocumentRelevancyEvaluator } from "../../src/llm/createDocumentRelevancyEvaluator";
import * as generateClassificationModule from "../../src/llm/generateClassification";

import { openai } from "@ai-sdk/openai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("createDocumentRelevancyEvaluator", () => {
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

  const customDocumentRelevancyTemplate = `
    Custom template for document relevancy detection:
    Question: {{input}}
    Document text: {{documentText}}
    Is the document text relevant to the question? Respond with "relevant" or "unrelated".
  `;

  it("should create a document relevancy evaluator with default template and choices", async () => {
    // Mock the generateClassification function
    const mockGenerateClassification = vi
      .spyOn(generateClassificationModule, "generateClassification")
      .mockResolvedValue({
        label: "relevant",
        explanation: "The document text is relevant to the question",
      });

    const evaluator = createDocumentRelevancyEvaluator({
      model,
    });

    const result = await evaluator.evaluate({
      input: "What is Arize Phoenix?",
      documentText:
        "Arize Phoenix is a platform for building and deploying AI applications.",
    });

    // Verify the function was called with default template and choices
    expect(mockGenerateClassification).toHaveBeenCalledWith(
      expect.objectContaining({
        labels: ["relevant", "unrelated"],
        prompt: expect.arrayContaining([
          expect.objectContaining({
            role: "user",
            content: expect.stringContaining(
              "You are comparing a document to a question"
            ),
          }),
        ]),
      })
    );

    expect(result.label).toBe("relevant");
    expect(result.score).toBe(1); // relevant = 1 in default choices
    expect(result.explanation).toBe(
      "The document text is relevant to the question"
    );
  });

  it("should support custom template", async () => {
    // Mock the generateClassification function
    const mockGenerateClassification = vi
      .spyOn(generateClassificationModule, "generateClassification")
      .mockResolvedValue({
        label: "no",
        explanation: "The document text is not relevant to the question",
      });

    const evaluator = createDocumentRelevancyEvaluator({
      model,
      promptTemplate: customDocumentRelevancyTemplate,
      choices: { yes: 0, no: 1 }, // Custom choices for custom template
    });

    const result = await evaluator.evaluate({
      input: "How much does Arize Phoenix cost?",
      documentText:
        "Arize Phoenix is a platform for building and deploying AI applications.",
    });

    // Verify the function was called with custom template
    expect(mockGenerateClassification).toHaveBeenCalledWith(
      expect.objectContaining({
        labels: ["yes", "no"],
        prompt: expect.stringContaining(
          "Custom template for document relevancy detection"
        ),
      })
    );

    expect(result.label).toBe("no");
    expect(result.score).toBe(1); // no = 1 in custom choices
  });

  it("should support custom choices with default template", async () => {
    // Mock the generateClassification function
    vi.spyOn(
      generateClassificationModule,
      "generateClassification"
    ).mockResolvedValue({
      label: "relevant",
      explanation: "The document text is relevant to the question",
    });

    const customChoices = { relevant: 0.8, unrelated: 0.2 };

    const evaluator = createDocumentRelevancyEvaluator({
      model,
      choices: customChoices,
    });

    const result = await evaluator.evaluate({
      input: "What is Arize Phoenix?",
      documentText:
        "Arize Phoenix is a platform for building and deploying AI applications.",
    });

    expect(result.label).toBe("relevant");
    expect(result.score).toBe(0.8); // Custom score for relevant
  });

  it("should have telemetry enabled by default", async () => {
    // Mock the generateClassification function to spy on telemetry configuration
    const mockGenerateClassification = vi
      .spyOn(generateClassificationModule, "generateClassification")
      .mockResolvedValue({
        label: "relevant",
        explanation: "This is a test explanation",
      });

    const evaluator = createDocumentRelevancyEvaluator({
      model,
      // Note: we're not explicitly setting telemetry options here
    });

    await evaluator.evaluate({
      input: "What is Arize Phoenix?",
      documentText:
        "Arize Phoenix is a platform for building and deploying AI applications.",
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
        label: "relevant",
        explanation: "This is a test explanation",
      });

    const evaluator = createDocumentRelevancyEvaluator({
      model,
      telemetry: { isEnabled: false }, // Explicitly disable telemetry
    });

    await evaluator.evaluate({
      input: "What is Arize Phoenix?",
      documentText:
        "Arize Phoenix is a platform for building and deploying AI applications.",
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
        label: "relevant",
        explanation: "This is a test explanation",
      });

    const customTracer = {} as import("@opentelemetry/api").Tracer; // Mock tracer object

    const evaluator = createDocumentRelevancyEvaluator({
      model,
      telemetry: {
        isEnabled: true,
        tracer: customTracer,
      },
    });

    await evaluator.evaluate({
      input: "What is Arize Phoenix?",
      documentText:
        "Arize Phoenix is a platform for building and deploying AI applications.",
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
        label: "relevant",
        explanation: "Template variables correctly interpolated",
      });

    const evaluator = createDocumentRelevancyEvaluator({
      model,
    });

    const testInput = "What is the capital of France?";
    const testOutput = "Paris is the capital and largest city of France.";

    await evaluator.evaluate({
      documentText: testOutput,
      input: testInput,
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
  });
});

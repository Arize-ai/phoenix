import { createClassifierFn } from "../../src/llm/createClassifierFn";
import * as generateClassificationModule from "../../src/llm/generateClassification";

import { MockLanguageModelV2 } from "ai/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("createClassifier", () => {
  beforeEach(() => {
    // Mock the OpenAI API key environment variable
    vi.stubEnv("OPENAI_API_KEY", "sk-dummy-test-key-12345");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const hallucinationPromptTemplate = `
In this task, you will be presented with a query, a reference text and an answer. The answer is
generated to the question based on the reference text. The answer may contain false information. You
must use the reference text to determine if the answer to the question contains false information,
if the answer is a hallucination of facts. Your objective is to determine whether the answer text
contains factual information and is not a hallucination. A 'hallucination' refers to
an answer that is not based on the reference text or assumes information that is not available in
the reference text. Your response should be a single word: either "factual" or "hallucinated", and
it should not include any other text or characters. "hallucinated" indicates that the answer
provides factually inaccurate information to the query based on the reference text. "factual"
indicates that the answer to the question is correct relative to the reference text, and does not
contain made up information. Please read the query and reference text carefully before determining
your response.

    [BEGIN DATA]
    ************
    [Query]: {{input}}
    ************
    [Reference text]: {{reference}}
    ************
    [Answer]: {{output}}
    ************
    [END DATA]

Is the answer above factual or hallucinated based on the query and reference text?
`;

  it("should create a llm classifier", async () => {
    // Arrange
    const mockModel = new MockLanguageModelV2({
      doGenerate: async () => ({
        finishReason: "stop",
        usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
        content: [
          {
            type: "text",
            text: '{"explanation": "The answer states that Arize is not open source, but the reference text clearly states that Arize Phoenix is open source. This is directly contradicted by the reference material.", "label": "hallucinated"}',
          },
        ],
        warnings: [],
      }),
    });

    const classifier = createClassifierFn({
      model: mockModel,
      choices: { factual: 1, hallucinated: 0 },
      promptTemplate: hallucinationPromptTemplate,
    });

    // Act
    const result = await classifier({
      output: "Arize is not open source.",
      input: "Is Arize Phoenix Open Source?",
      reference:
        "Arize Phoenix is a platform for building and deploying AI applications. It is open source.",
    });

    // Assert
    expect(result.score).toBe(0);
    expect(result.label).toBe("hallucinated");
    expect(result.explanation).toContain("contradicted");
  });

  it("should have telemetry enabled by default", async () => {
    // Arrange
    const mockModel = new MockLanguageModelV2({
      doGenerate: async () => ({
        finishReason: "stop",
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        content: [
          {
            type: "text",
            text: '{"explanation": "Test explanation", "label": "factual"}',
          },
        ],
        warnings: [],
      }),
    });

    // Spy on generateClassification to verify telemetry configuration
    const generateClassificationSpy = vi.spyOn(
      generateClassificationModule,
      "generateClassification"
    );
    generateClassificationSpy.mockResolvedValue({
      label: "factual",
      explanation: "Test explanation",
    });

    const classifier = createClassifierFn({
      model: mockModel,
      choices: { factual: 1, hallucinated: 0 },
      promptTemplate: hallucinationPromptTemplate,
      // No telemetry config provided - should default to enabled
    });

    // Act
    const result = await classifier({
      output: "Test output",
      input: "Test input",
      reference: "Test reference",
    });

    // Assert generateClassification was called with correct arguments
    expect(generateClassificationSpy).toHaveBeenCalledTimes(1);
    const callArgs = generateClassificationSpy.mock.calls[0]?.[0];

    // Verify basic arguments are present
    expect(callArgs).toEqual(
      expect.objectContaining({
        model: expect.any(Object),
        labels: expect.arrayContaining(["factual", "hallucinated"]),
        prompt: expect.stringContaining("Test input"),
      })
    );

    // Verify telemetry defaults to undefined (which means enabled in generateClassification)
    expect(callArgs?.telemetry).toBeUndefined();

    // Verify the classifier works correctly
    expect(result.score).toBe(1);
    expect(result.label).toBe("factual");

    // Cleanup
    generateClassificationSpy.mockRestore();
  });

  it("should respect explicitly disabled telemetry", async () => {
    // Arrange
    const mockModel = new MockLanguageModelV2({
      doGenerate: async () => ({
        finishReason: "stop",
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        content: [
          {
            type: "text",
            text: '{"explanation": "Test explanation", "label": "factual"}',
          },
        ],
        warnings: [],
      }),
    });

    // Spy on generateClassification to verify telemetry configuration
    const generateClassificationSpy = vi.spyOn(
      generateClassificationModule,
      "generateClassification"
    );
    generateClassificationSpy.mockResolvedValue({
      label: "factual",
      explanation: "Test explanation",
    });

    const classifier = createClassifierFn({
      model: mockModel,
      choices: { factual: 1, hallucinated: 0 },
      promptTemplate: hallucinationPromptTemplate,
      telemetry: { isEnabled: false },
    });

    // Act
    const result = await classifier({
      output: "Test output",
      input: "Test input",
      reference: "Test reference",
    });

    // Assert telemetry is explicitly disabled
    expect(generateClassificationSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        model: expect.any(Object),
        labels: expect.arrayContaining(["factual", "hallucinated"]),
        prompt: expect.stringContaining("Test input"),
        telemetry: expect.objectContaining({
          isEnabled: false,
        }),
      })
    );

    // Also verify the classifier works correctly
    expect(result.score).toBe(1);
    expect(result.label).toBe("factual");

    // Cleanup
    generateClassificationSpy.mockRestore();
  });
});

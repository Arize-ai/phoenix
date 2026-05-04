import type * as AiModule from "ai";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { z, ZodObject } from "zod";

import { generateClassification } from "../../src/llm/generateClassification";

// Capture the schema passed to generateObject so we can assert field ordering.
const generateObjectMock = vi.fn();
vi.mock("ai", async () => {
  const actual = await vi.importActual<typeof AiModule>("ai");
  return {
    ...actual,
    generateObject: (args: unknown) => generateObjectMock(args),
  };
});

describe("generateClassification schema field ordering", () => {
  afterEach(() => {
    generateObjectMock.mockReset();
  });

  it("places explanation before label when includeExplanation defaults to true", async () => {
    generateObjectMock.mockResolvedValue({
      object: { explanation: "because", label: "factual" },
    });

    await generateClassification({
      // @ts-expect-error - mock model: any
      model: {},
      labels: ["factual", "hallucinated"],
      prompt: "is the answer factual?",
    });

    expect(generateObjectMock).toHaveBeenCalledTimes(1);
    const passedSchema = generateObjectMock.mock.calls[0]?.[0]
      ?.schema as ZodObject<Record<string, z.ZodTypeAny>>;
    // Field-insertion order in the JSON schema (and structured-output token
    // order) follows Zod's .shape key order. `explanation` MUST come first so
    // the model emits its rationale before committing to a label —
    // chain-of-thought scaffold for classification.
    expect(Object.keys(passedSchema.shape)).toEqual(["explanation", "label"]);
  });

  it("places explanation before label when includeExplanation is explicitly true", async () => {
    generateObjectMock.mockResolvedValue({
      object: { explanation: "because", label: "factual" },
    });

    await generateClassification({
      // @ts-expect-error - mock model: any
      model: {},
      labels: ["factual", "hallucinated"],
      prompt: "is the answer factual?",
      includeExplanation: true,
    });

    const passedSchema = generateObjectMock.mock.calls[0]?.[0]
      ?.schema as ZodObject<Record<string, z.ZodTypeAny>>;
    expect(Object.keys(passedSchema.shape)).toEqual(["explanation", "label"]);
  });

  it("emits only label when includeExplanation is false", async () => {
    generateObjectMock.mockResolvedValue({
      object: { label: "factual" },
    });

    await generateClassification({
      // @ts-expect-error - mock model: any
      model: {},
      labels: ["factual", "hallucinated"],
      prompt: "is the answer factual?",
      includeExplanation: false,
    });

    const passedSchema = generateObjectMock.mock.calls[0]?.[0]
      ?.schema as ZodObject<Record<string, z.ZodTypeAny>>;
    expect(Object.keys(passedSchema.shape)).toEqual(["label"]);
  });
});

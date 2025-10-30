import { addSpanAnnotation } from "../../src/spans/addSpanAnnotation";

import { beforeEach, describe, expect, it, vi } from "vitest";

// Create mock POST function
const mockPOST = vi.fn();

// Mock the fetch module
vi.mock("openapi-fetch", () => ({
  default: () => ({
    POST: mockPOST.mockResolvedValue({
      data: {
        data: [{ id: "test-id-1" }],
      },
      error: null,
    }),
    use: () => {},
  }),
}));

describe("addSpanAnnotation", () => {
  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();
    // Reset default mock behavior
    mockPOST.mockResolvedValue({
      data: {
        data: [{ id: "test-id-1" }],
      },
      error: null,
    });
  });

  it("should add a span annotation with all fields", async () => {
    const result = await addSpanAnnotation({
      spanAnnotation: {
        spanId: "123abc",
        name: "quality_score",
        label: "good",
        score: 0.95,
        annotatorKind: "LLM",
        identifier: "test-identifier",
        metadata: { source: "test" },
      },
      sync: true,
    });

    expect(result).toEqual({ id: "test-id-1" });
  });

  it("should add a span annotation with explanation", async () => {
    const result = await addSpanAnnotation({
      spanAnnotation: {
        spanId: "123abc",
        name: "quality_score",
        explanation: "This is a detailed explanation",
        annotatorKind: "LLM",
      },
      sync: true,
    });

    expect(result).toEqual({ id: "test-id-1" });
  });

  it("should add a span annotation with minimum required fields", async () => {
    const result = await addSpanAnnotation({
      spanAnnotation: {
        spanId: "123abc",
        name: "quality_score",
        label: "good", // Now required - at least one result field needed
      },
      sync: true,
    });

    expect(result).toEqual({ id: "test-id-1" });
  });

  it("should return null when sync=false (default)", async () => {
    // Mock server returns no data for async calls
    mockPOST.mockResolvedValueOnce({
      data: undefined,
      error: undefined,
    });

    const result = await addSpanAnnotation({
      spanAnnotation: {
        spanId: "123abc",
        name: "quality_score",
        label: "good",
      },
      // sync defaults to false
    });

    expect(result).toBeNull();
  });

  it("should throw error when no result fields are provided", async () => {
    await expect(
      addSpanAnnotation({
        spanAnnotation: {
          spanId: "123abc",
          name: "quality_score",
          // No label, score, or explanation provided
        },
      })
    ).rejects.toThrow(
      "At least one of label, score, or explanation must be provided for span annotation"
    );
  });
});

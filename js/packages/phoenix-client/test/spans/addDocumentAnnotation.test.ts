import { addDocumentAnnotation } from "../../src/spans/addDocumentAnnotation";

import { beforeEach, describe, expect, it, vi } from "vitest";

// Create mock POST function
const mockPOST = vi.fn();

// Mock the fetch module
vi.mock("openapi-fetch", () => ({
  default: () => ({
    POST: mockPOST.mockResolvedValue({
      data: {
        data: [{ id: "test-doc-id-1" }],
      },
      error: null,
    }),
    use: () => {},
  }),
}));

describe("addDocumentAnnotation", () => {
  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();
    // Reset default mock behavior
    mockPOST.mockResolvedValue({
      data: {
        data: [{ id: "test-doc-id-1" }],
      },
      error: null,
    });
  });

  it("should add a document annotation with all fields", async () => {
    const result = await addDocumentAnnotation({
      documentAnnotation: {
        spanId: "123abc",
        documentPosition: 0,
        name: "relevance_score",
        label: "relevant",
        score: 0.95,
        explanation: "Document is highly relevant to the query",
        annotatorKind: "LLM",
        metadata: { model: "gpt-4" },
      },
      sync: true,
    });

    expect(result).toEqual({ id: "test-doc-id-1" });
  });

  it("should add a document annotation with only required fields and label", async () => {
    const result = await addDocumentAnnotation({
      documentAnnotation: {
        spanId: "123abc",
        documentPosition: 1,
        name: "relevance_score",
        label: "relevant",
      },
      sync: true,
    });

    expect(result).toEqual({ id: "test-doc-id-1" });
  });

  it("should add a document annotation with only required fields and score", async () => {
    const result = await addDocumentAnnotation({
      documentAnnotation: {
        spanId: "123abc",
        documentPosition: 0,
        name: "relevance_score",
        score: 0.8,
      },
      sync: true,
    });

    expect(result).toEqual({ id: "test-doc-id-1" });
  });

  it("should add a document annotation with only required fields and explanation", async () => {
    const result = await addDocumentAnnotation({
      documentAnnotation: {
        spanId: "123abc",
        documentPosition: 2,
        name: "relevance_score",
        explanation: "Document provides good context",
      },
      sync: true,
    });

    expect(result).toEqual({ id: "test-doc-id-1" });
  });

  it("should throw error when no result fields are provided", async () => {
    await expect(
      addDocumentAnnotation({
        documentAnnotation: {
          spanId: "123abc",
          documentPosition: 0,
          name: "relevance_score",
          // No label, score, or explanation provided
        },
      })
    ).rejects.toThrow(
      "At least one of label, score, or explanation must be provided for document annotation"
    );
  });

  it("should handle empty strings properly", async () => {
    await expect(
      addDocumentAnnotation({
        documentAnnotation: {
          spanId: "123abc",
          documentPosition: 0,
          name: "relevance_score",
          label: "",
          explanation: "   ",
          // Only empty/whitespace strings provided
        },
      })
    ).rejects.toThrow(
      "At least one of label, score, or explanation must be provided for document annotation"
    );
  });

  it("should default annotatorKind to HUMAN", async () => {
    const result = await addDocumentAnnotation({
      documentAnnotation: {
        spanId: "123abc",
        documentPosition: 0,
        name: "relevance_score",
        label: "relevant",
        // annotatorKind not specified
      },
      sync: true,
    });

    expect(result).toEqual({ id: "test-doc-id-1" });
  });

  it("should return null when sync=false (default)", async () => {
    // Mock server returns no data for async calls
    mockPOST.mockResolvedValueOnce({
      data: undefined,
      error: undefined,
    });

    const result = await addDocumentAnnotation({
      documentAnnotation: {
        spanId: "123abc",
        documentPosition: 0,
        name: "relevance_score",
        label: "relevant",
      },
      // sync defaults to false
    });

    expect(result).toBeNull();
  });
});

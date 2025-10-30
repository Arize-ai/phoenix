import { logDocumentAnnotations } from "../../src/spans/logDocumentAnnotations";

import { beforeEach, describe, expect, it, vi } from "vitest";

// Create mock POST function
const mockPOST = vi.fn();

// Mock the fetch module
vi.mock("openapi-fetch", () => ({
  default: () => ({
    POST: mockPOST.mockResolvedValue({
      data: {
        data: [{ id: "test-doc-id-1" }, { id: "test-doc-id-2" }],
      },
      error: null,
    }),
    use: () => {},
  }),
}));

describe("logDocumentAnnotations", () => {
  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();
    // Reset default mock behavior
    mockPOST.mockResolvedValue({
      data: {
        data: [{ id: "test-doc-id-1" }, { id: "test-doc-id-2" }],
      },
      error: null,
    });
  });

  it("should log multiple document annotations", async () => {
    const result = await logDocumentAnnotations({
      documentAnnotations: [
        {
          spanId: "123abc",
          documentPosition: 0,
          name: "relevance_score",
          label: "relevant",
          score: 0.95,
          explanation: "Document is highly relevant to the query",
          annotatorKind: "LLM",
          metadata: { model: "gpt-4" },
        },
        {
          spanId: "123abc",
          documentPosition: 1,
          name: "relevance_score",
          label: "somewhat_relevant",
          score: 0.6,
          annotatorKind: "CODE",
        },
      ],
      sync: true,
    });

    expect(result).toEqual([{ id: "test-doc-id-1" }, { id: "test-doc-id-2" }]);
  });

  it("should log document annotations with different annotation types", async () => {
    const result = await logDocumentAnnotations({
      documentAnnotations: [
        {
          spanId: "123abc",
          documentPosition: 0,
          name: "relevance_score",
          score: 0.95,
          annotatorKind: "LLM",
        },
        {
          spanId: "456def",
          documentPosition: 0,
          name: "quality",
          label: "high",
          annotatorKind: "HUMAN",
        },
        {
          spanId: "789ghi",
          documentPosition: 2,
          name: "sentiment",
          explanation: "Positive sentiment detected",
          annotatorKind: "CODE",
        },
      ],
      sync: true,
    });

    expect(result).toEqual([{ id: "test-doc-id-1" }, { id: "test-doc-id-2" }]);
  });

  it("should handle document annotations for different spans and positions", async () => {
    const result = await logDocumentAnnotations({
      documentAnnotations: [
        {
          spanId: "span1",
          documentPosition: 0,
          name: "relevance",
          label: "relevant",
        },
        {
          spanId: "span1",
          documentPosition: 1,
          name: "relevance",
          label: "not_relevant",
        },
        {
          spanId: "span2",
          documentPosition: 0,
          name: "quality",
          score: 0.8,
        },
      ],
      sync: true,
    });

    expect(result).toEqual([{ id: "test-doc-id-1" }, { id: "test-doc-id-2" }]);
  });

  it("should throw error when annotation has no result fields", async () => {
    await expect(
      logDocumentAnnotations({
        documentAnnotations: [
          {
            spanId: "123abc",
            documentPosition: 0,
            name: "relevance_score",
            label: "relevant", // This one is valid
          },
          {
            spanId: "456def",
            documentPosition: 1,
            name: "quality_score",
            // No label, score, or explanation - should fail
          },
        ],
      })
    ).rejects.toThrow(
      "At least one of label, score, or explanation must be provided for document annotation"
    );
  });

  it("should trim whitespace from string fields", async () => {
    const result = await logDocumentAnnotations({
      documentAnnotations: [
        {
          spanId: "  123abc  ",
          documentPosition: 0,
          name: "  relevance_score  ",
          label: "  relevant  ",
          explanation: "  Good document  ",
        },
      ],
      sync: true,
    });

    expect(result).toEqual([{ id: "test-doc-id-1" }, { id: "test-doc-id-2" }]);
  });

  it("should return empty array when sync=false (default)", async () => {
    // Mock server returns no data for async calls
    mockPOST.mockResolvedValueOnce({
      data: undefined,
      error: undefined,
    });

    const result = await logDocumentAnnotations({
      documentAnnotations: [
        {
          spanId: "123abc",
          documentPosition: 0,
          name: "relevance_score",
          label: "relevant",
        },
      ],
      // sync defaults to false
    });

    expect(result).toEqual([]);
  });
});

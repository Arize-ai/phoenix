import { describe, it, expect, vi, beforeEach } from "vitest";
import { getSpanAnnotations } from "../../src/spans/getSpanAnnotations";

// Mock the fetch module
const mockGet = vi.fn();
vi.mock("openapi-fetch", () => ({
  default: () => ({
    GET: mockGet,
  }),
}));

describe("getSpanAnnotations", () => {
  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();

    // Default mock response
    mockGet.mockResolvedValue({
      data: {
        next_cursor: "next-cursor-123",
        data: [
          {
            id: "annotation-global-id-123",
            span_id: "span-456",
            name: "quality_score",
            annotator_kind: "LLM",
            result: {
              label: "good",
              score: 0.95,
              explanation: null,
            },
            metadata: {
              model: "gpt-4",
              source: "test",
            },
            identifier: "test-identifier",
          },
          {
            id: "annotation-global-id-124",
            span_id: "span-457",
            name: "sentiment",
            annotator_kind: "HUMAN",
            result: {
              label: "positive",
              score: 0.8,
              explanation: "User expressed satisfaction",
            },
            metadata: {
              reviewer: "john_doe",
            },
            identifier: "sentiment-001",
          },
        ],
      },
      error: null,
    });
  });

  it("should get span annotations with basic parameters", async () => {
    const result = await getSpanAnnotations({
      project: { projectName: "test-project" },
      spanIds: ["span-456", "span-457"],
    });

    expect(result.annotations).toHaveLength(2);
    expect(result.annotations[0]?.span_id).toBe("span-456");
    expect(result.annotations[0]?.name).toBe("quality_score");
    expect(result.annotations[1]?.span_id).toBe("span-457");
    expect(result.annotations[1]?.name).toBe("sentiment");
    expect(result.nextCursor).toBe("next-cursor-123");
  });

  it("should get span annotations with all supported filter parameters", async () => {
    const result = await getSpanAnnotations({
      project: { projectName: "test-project" },
      spanIds: ["span-456"],
      includeAnnotationNames: ["quality_score"],
      excludeAnnotationNames: ["note"],
      cursor: "cursor-123",
      limit: 50,
    });

    expect(result.annotations).toHaveLength(2);
    expect(result.nextCursor).toBe("next-cursor-123");
  });

  it("should get span annotations with include annotation names filter", async () => {
    const result = await getSpanAnnotations({
      project: { projectName: "test-project" },
      spanIds: ["span-456", "span-457"],
      includeAnnotationNames: ["quality_score"],
    });

    expect(result.annotations).toHaveLength(2);
    // Note: The mock response doesn't simulate filtering by annotation name,
    // so we still get 2 annotations even though in real usage with
    // includeAnnotationNames: ["quality_score"] we would expect only 1
    expect(result.annotations.some((a) => a.name === "quality_score")).toBe(
      true
    );
  });

  it("should get span annotations with exclude annotation names filter", async () => {
    const result = await getSpanAnnotations({
      project: { projectName: "test-project" },
      spanIds: ["span-456", "span-457"],
      excludeAnnotationNames: ["note"],
    });

    expect(result.annotations).toHaveLength(2);
    // Note: The mock response doesn't simulate filtering by annotation name,
    // so we still get 2 annotations even though in real usage with
    // excludeAnnotationNames: ["note"] we would filter out note annotations
    expect(result.annotations.every((a) => a.name !== "note")).toBe(true);
  });

  it("should handle empty arrays for include/exclude filters", async () => {
    const result = await getSpanAnnotations({
      project: { projectName: "test-project" },
      spanIds: ["span-456"],
      includeAnnotationNames: [],
      excludeAnnotationNames: [],
    });

    expect(result.annotations).toHaveLength(2);
    expect(result.nextCursor).toBe("next-cursor-123");
  });

  it("should handle pagination with cursor", async () => {
    const result = await getSpanAnnotations({
      project: { projectName: "test-project" },
      spanIds: ["span-456"],
      cursor: "some-cursor-value",
      limit: 25,
    });

    expect(result.annotations).toHaveLength(2);
    expect(result.nextCursor).toBe("next-cursor-123");
  });

  it("should work with project ID instead of project name", async () => {
    const result = await getSpanAnnotations({
      project: { projectId: "project-123" },
      spanIds: ["span-456"],
    });

    expect(result.annotations).toHaveLength(2);
    expect(result.nextCursor).toBe("next-cursor-123");
  });

  it("should handle empty annotations response", async () => {
    // Mock empty response
    mockGet.mockResolvedValue({
      data: {
        next_cursor: null,
        data: [],
      },
      error: null,
    });

    const result = await getSpanAnnotations({
      project: { projectName: "test-project" },
      spanIds: ["span-456"],
    });

    expect(result.annotations).toHaveLength(0);
    expect(result.nextCursor).toBeNull();
  });

  it("should handle API errors", async () => {
    // Mock error response
    mockGet.mockResolvedValue({
      data: null,
      error: new Error("API Error"),
    });

    await expect(
      getSpanAnnotations({
        project: { projectName: "test-project" },
        spanIds: ["span-456"],
      })
    ).rejects.toThrow("API Error");
  });
});

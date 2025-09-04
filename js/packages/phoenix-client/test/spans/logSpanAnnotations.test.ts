import { describe, it, expect, vi, beforeEach } from "vitest";
import { logSpanAnnotations } from "../../src/spans/logSpanAnnotations";

// Mock the fetch module
vi.mock("openapi-fetch", () => ({
  default: () => ({
    POST: vi.fn().mockResolvedValue({
      data: {
        data: [{ id: "test-id-1" }, { id: "test-id-2" }],
      },
      error: null,
    }),
  }),
}));

describe("logSpanAnnotations", () => {
  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();
  });

  it("should log multiple span annotations", async () => {
    const result = await logSpanAnnotations({
      spanAnnotations: [
        {
          spanId: "123abc",
          name: "quality_score",
          label: "good",
          score: 0.95,
          annotatorKind: "LLM",
        },
        {
          spanId: "456def",
          name: "sentiment",
          label: "positive",
          score: 0.8,
          annotatorKind: "CODE",
        },
      ],
      sync: true,
    });

    expect(result).toEqual([{ id: "test-id-1" }, { id: "test-id-2" }]);
  });

  it("should return null when sync=false (default)", async () => {
    const result = await logSpanAnnotations({
      spanAnnotations: [
        {
          spanId: "123abc",
          name: "quality_score",
          label: "good",
        },
      ],
      // sync defaults to false
    });

    expect(result).toBeNull();
  });
});

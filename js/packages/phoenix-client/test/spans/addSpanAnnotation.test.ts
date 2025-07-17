import { describe, it, expect, vi, beforeEach } from "vitest";
import { addSpanAnnotation } from "../../src/spans/addSpanAnnotation";

// Mock the fetch module
vi.mock("openapi-fetch", () => ({
  default: () => ({
    POST: vi.fn().mockResolvedValue({
      data: {
        data: [{ id: "test-id-1" }],
      },
      error: null,
    }),
  }),
}));

describe("addSpanAnnotation", () => {
  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();
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
    });

    expect(result).toEqual({ id: "test-id-1" });
  });

  it("should add a span annotation with only required fields", async () => {
    const result = await addSpanAnnotation({
      spanAnnotation: {
        spanId: "123abc",
        name: "quality_score",
      },
    });

    expect(result).toEqual({ id: "test-id-1" });
  });
});

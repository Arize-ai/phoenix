import { describe, it, expect, vi, beforeEach } from "vitest";
import { getSpans } from "../../src/spans/getSpans";

// Mock the fetch module
vi.mock("openapi-fetch", () => ({
  default: () => ({
    GET: vi.fn().mockResolvedValue({
      data: {
        next_cursor: "next-cursor-123",
        data: [
          {
            trace_id: "trace-123",
            span_id: "span-456",
            name: "test-span",
            start_time_unix_nano: "1640995200000000000",
            end_time_unix_nano: "1640995201000000000",
            attributes: [
              {
                key: "test.attribute",
                value: { string_value: "test-value" },
              },
            ],
            status: {
              code: 1,
              message: "OK",
            },
          },
        ],
      },
      error: null,
    }),
  }),
}));

describe("getSpans", () => {
  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();
  });

  it("should get spans with basic parameters", async () => {
    const result = await getSpans({
      projectIdentifier: "test-project",
    });

    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.span_id).toBe("span-456");
    expect(result.data[0]?.name).toBe("test-span");
    expect(result.next_cursor).toBe("next-cursor-123");
  });

  it("should get spans with all filter parameters", async () => {
    const startTime = new Date("2022-01-01T00:00:00Z");
    const endTime = new Date("2022-01-02T00:00:00Z");

    const result = await getSpans({
      projectIdentifier: "test-project",
      cursor: "cursor-123",
      limit: 50,
      sortDirection: "asc",
      startTime: startTime,
      endTime: endTime,
      annotationNames: ["quality"],
    });

    expect(result.data).toHaveLength(1);
    expect(result.next_cursor).toBe("next-cursor-123");
  });

  it("should get spans with string time parameters", async () => {
    const result = await getSpans({
      projectIdentifier: "test-project",
      startTime: "2022-01-01T00:00:00Z",
      endTime: "2022-01-02T00:00:00Z",
    });

    expect(result.data).toHaveLength(1);
  });

  it("should handle empty annotation names array", async () => {
    const result = await getSpans({
      projectIdentifier: "test-project",
      annotationNames: [],
    });

    expect(result.data).toHaveLength(1);
  });
});

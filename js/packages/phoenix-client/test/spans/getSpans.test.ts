import { getSpans } from "../../src/spans/getSpans";

import { beforeEach,describe, expect, it, vi } from "vitest";

// Mock the fetch module
vi.mock("openapi-fetch", () => ({
  default: () => ({
    GET: vi.fn().mockResolvedValue({
      data: {
        next_cursor: "next-cursor-123",
        data: [
          {
            id: "span-global-id-123",
            name: "test-span",
            context: {
              trace_id: "trace-123",
              span_id: "span-456",
            },
            span_kind: "INTERNAL",
            parent_id: null,
            start_time: "2022-01-01T00:00:00Z",
            end_time: "2022-01-01T00:00:01Z",
            status_code: "OK",
            status_message: "",
            attributes: {
              "test.attribute": "test-value",
              "http.method": "GET",
            },
            events: [],
          },
        ],
      },
      error: null,
    }),
    use: () => {},
  }),
}));

describe("getSpans", () => {
  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();
  });

  it("should get spans with basic parameters", async () => {
    const result = await getSpans({
      project: { projectName: "test-project" },
    });

    expect(result.spans).toHaveLength(1);
    expect(result.spans[0]?.context.span_id).toBe("span-456");
    expect(result.spans[0]?.name).toBe("test-span");
    expect(result.nextCursor).toBe("next-cursor-123");
  });

  it("should get spans with all supported filter parameters", async () => {
    const startTime = new Date("2022-01-01T00:00:00Z");
    const endTime = new Date("2022-01-02T00:00:00Z");

    const result = await getSpans({
      project: { projectName: "test-project" },
      cursor: "cursor-123",
      limit: 50,
      startTime: startTime,
      endTime: endTime,
    });

    expect(result.spans).toHaveLength(1);
    expect(result.nextCursor).toBe("next-cursor-123");
  });

  it("should get spans with string time parameters", async () => {
    const result = await getSpans({
      project: { projectName: "test-project" },
      startTime: "2022-01-01T00:00:00Z",
      endTime: "2022-01-02T00:00:00Z",
    });

    expect(result.spans).toHaveLength(1);
  });

  it("should handle pagination with cursor", async () => {
    const result = await getSpans({
      project: { projectName: "test-project" },
      cursor: "some-cursor-value",
      limit: 25,
    });

    expect(result.spans).toHaveLength(1);
  });
});

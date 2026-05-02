import { beforeEach, describe, expect, it, vi } from "vitest";

import { getSpans } from "../../src/spans/getSpans";

// Mock the fetch module with an inspectable mock
const mockGet = vi.fn();
vi.mock("openapi-fetch", () => ({
  default: () => ({
    GET: mockGet,
    use: () => {},
  }),
}));

const defaultMockResponse = {
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
};

describe("getSpans", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockResolvedValue(defaultMockResponse);
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

  describe("filter parameters (name, spanKind, statusCode)", () => {
    it("should send name as array when given a single string", async () => {
      await getSpans({
        project: { projectName: "test-project" },
        name: "my-span",
      });

      expect(mockGet).toHaveBeenCalledWith(
        "/v1/projects/{project_identifier}/spans",
        expect.objectContaining({
          params: expect.objectContaining({
            query: expect.objectContaining({
              name: ["my-span"],
            }),
          }),
        })
      );
    });

    it("should send name as array when given an array", async () => {
      await getSpans({
        project: { projectName: "test-project" },
        name: ["span-a", "span-b"],
      });

      expect(mockGet).toHaveBeenCalledWith(
        "/v1/projects/{project_identifier}/spans",
        expect.objectContaining({
          params: expect.objectContaining({
            query: expect.objectContaining({
              name: ["span-a", "span-b"],
            }),
          }),
        })
      );
    });

    it("should send span_kind as array when given a single string", async () => {
      await getSpans({
        project: { projectName: "test-project" },
        spanKind: "LLM",
      });

      expect(mockGet).toHaveBeenCalledWith(
        "/v1/projects/{project_identifier}/spans",
        expect.objectContaining({
          params: expect.objectContaining({
            query: expect.objectContaining({
              span_kind: ["LLM"],
            }),
          }),
        })
      );
    });

    it("should send span_kind as array when given an array", async () => {
      await getSpans({
        project: { projectName: "test-project" },
        spanKind: ["LLM", "CHAIN"],
      });

      expect(mockGet).toHaveBeenCalledWith(
        "/v1/projects/{project_identifier}/spans",
        expect.objectContaining({
          params: expect.objectContaining({
            query: expect.objectContaining({
              span_kind: ["LLM", "CHAIN"],
            }),
          }),
        })
      );
    });

    it("should send status_code as array when given a single string", async () => {
      await getSpans({
        project: { projectName: "test-project" },
        statusCode: "ERROR",
      });

      expect(mockGet).toHaveBeenCalledWith(
        "/v1/projects/{project_identifier}/spans",
        expect.objectContaining({
          params: expect.objectContaining({
            query: expect.objectContaining({
              status_code: ["ERROR"],
            }),
          }),
        })
      );
    });

    it("should send status_code as array when given an array", async () => {
      await getSpans({
        project: { projectName: "test-project" },
        statusCode: ["OK", "ERROR"],
      });

      expect(mockGet).toHaveBeenCalledWith(
        "/v1/projects/{project_identifier}/spans",
        expect.objectContaining({
          params: expect.objectContaining({
            query: expect.objectContaining({
              status_code: ["OK", "ERROR"],
            }),
          }),
        })
      );
    });

    it("should not send filter params when undefined", async () => {
      await getSpans({
        project: { projectName: "test-project" },
      });

      const callArgs = mockGet.mock.calls[0]?.[1];
      expect(callArgs.params.query).not.toHaveProperty("name");
      expect(callArgs.params.query).not.toHaveProperty("span_kind");
      expect(callArgs.params.query).not.toHaveProperty("status_code");
    });
  });

  describe("attributes parameter", () => {
    it("should serialize a single attribute filter", async () => {
      await getSpans({
        project: { projectName: "test-project" },
        attributes: { "llm.model_name": "gpt-4" },
      });

      expect(mockGet).toHaveBeenCalledWith(
        "/v1/projects/{project_identifier}/spans",
        expect.objectContaining({
          params: expect.objectContaining({
            query: expect.objectContaining({
              attribute: ["llm.model_name:gpt-4"],
            }),
          }),
        })
      );
    });

    it("should serialize multiple attribute filters", async () => {
      await getSpans({
        project: { projectName: "test-project" },
        attributes: {
          "llm.model_name": "gpt-4",
          "llm.provider": "openai",
        },
      });

      expect(mockGet).toHaveBeenCalledWith(
        "/v1/projects/{project_identifier}/spans",
        expect.objectContaining({
          params: expect.objectContaining({
            query: expect.objectContaining({
              attribute: ["llm.model_name:gpt-4", "llm.provider:openai"],
            }),
          }),
        })
      );
    });

    it("should serialize numeric and boolean values without quotes", async () => {
      await getSpans({
        project: { projectName: "test-project" },
        attributes: {
          count: 42,
          cached: true,
        },
      });

      expect(mockGet).toHaveBeenCalledWith(
        "/v1/projects/{project_identifier}/spans",
        expect.objectContaining({
          params: expect.objectContaining({
            query: expect.objectContaining({
              attribute: ["count:42", "cached:true"],
            }),
          }),
        })
      );
    });

    it("should quote string values that look like non-string JSON", async () => {
      await getSpans({
        project: { projectName: "test-project" },
        attributes: {
          cached: "true",
          count: "42",
        },
      });

      expect(mockGet).toHaveBeenCalledWith(
        "/v1/projects/{project_identifier}/spans",
        expect.objectContaining({
          params: expect.objectContaining({
            query: expect.objectContaining({
              attribute: ['cached:"true"', 'count:"42"'],
            }),
          }),
        })
      );
    });

    it("should quote empty string values", async () => {
      await getSpans({
        project: { projectName: "test-project" },
        attributes: {
          model: "",
        },
      });

      expect(mockGet).toHaveBeenCalledWith(
        "/v1/projects/{project_identifier}/spans",
        expect.objectContaining({
          params: expect.objectContaining({
            query: expect.objectContaining({
              attribute: ['model:""'],
            }),
          }),
        })
      );
    });

    it("should not send attribute when attributes is undefined", async () => {
      await getSpans({
        project: { projectName: "test-project" },
      });

      const callArgs = mockGet.mock.calls[0]?.[1];
      expect(callArgs.params.query).not.toHaveProperty("attribute");
    });

    it("should omit attribute when attributes is an empty object", async () => {
      await getSpans({
        project: { projectName: "test-project" },
        attributes: {},
      });

      const callArgs = mockGet.mock.calls[0]?.[1];
      expect(callArgs.params.query).not.toHaveProperty("attribute");
    });

    it("should send attributes combined with other filters", async () => {
      await getSpans({
        project: { projectName: "test-project" },
        spanKind: "LLM",
        attributes: { "llm.model_name": "gpt-4" },
      });

      expect(mockGet).toHaveBeenCalledWith(
        "/v1/projects/{project_identifier}/spans",
        expect.objectContaining({
          params: expect.objectContaining({
            query: expect.objectContaining({
              span_kind: ["LLM"],
              attribute: ["llm.model_name:gpt-4"],
            }),
          }),
        })
      );
    });

    it("should reject non-finite numeric values", async () => {
      await expect(
        getSpans({
          project: { projectName: "test-project" },
          attributes: {
            score: Number.NaN,
          },
        })
      ).rejects.toThrow(RangeError);
    });
  });

  describe("parentId parameter", () => {
    it('should send parent_id="null" to get root spans only', async () => {
      await getSpans({
        project: { projectName: "test-project" },
        parentId: "null",
      });

      expect(mockGet).toHaveBeenCalledWith(
        "/v1/projects/{project_identifier}/spans",
        expect.objectContaining({
          params: expect.objectContaining({
            query: expect.objectContaining({
              parent_id: "null",
            }),
          }),
        })
      );
    });

    it("should send parent_id with a span ID to get children", async () => {
      await getSpans({
        project: { projectName: "test-project" },
        parentId: "span-abc-123",
      });

      expect(mockGet).toHaveBeenCalledWith(
        "/v1/projects/{project_identifier}/spans",
        expect.objectContaining({
          params: expect.objectContaining({
            query: expect.objectContaining({
              parent_id: "span-abc-123",
            }),
          }),
        })
      );
    });

    it("should not send parent_id when parentId is undefined", async () => {
      await getSpans({
        project: { projectName: "test-project" },
      });

      const callArgs = mockGet.mock.calls[0]?.[1];
      expect(callArgs.params.query).not.toHaveProperty("parent_id");
    });

    it('should send parent_id="null" when parentId is JS null (root spans)', async () => {
      await getSpans({
        project: { projectName: "test-project" },
        parentId: null,
      });

      const callArgs = mockGet.mock.calls[0]?.[1];
      expect(callArgs.params.query.parent_id).toBe("null");
    });
  });
});

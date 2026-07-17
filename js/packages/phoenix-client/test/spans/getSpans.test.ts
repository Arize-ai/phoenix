import { createHttp, type componentsV1 } from "@arizeai/phoenix-testing";
import { createMockServer, type Server } from "@arizeai/phoenix-testing/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { getSpans } from "../../src/spans/getSpans";
import { createTestClient } from "../testUtils";

const http = createHttp();

const spanFixtures: componentsV1["schemas"]["Span"][] = [
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
];

let server: Server;

beforeAll(async () => {
  server = await createMockServer();
  server.listen({ onUnhandledRequest: "error" });
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});

/**
 * Register a handler that answers with the default span fixtures and records
 * the request's path param and query string for later assertions.
 */
function captureGetSpansRequest() {
  const captured: {
    projectIdentifier?: string;
    query?: URLSearchParams;
  } = {};

  server.use(
    http.get(
      "/v1/projects/{project_identifier}/spans",
      ({ params, request, response }) => {
        captured.projectIdentifier = params.project_identifier;
        captured.query = new URL(request.url).searchParams;
        return response(200).json({
          next_cursor: "next-cursor-123",
          data: spanFixtures,
        });
      }
    )
  );

  return captured;
}

describe("getSpans", () => {
  it("should get spans with basic parameters", async () => {
    const captured = captureGetSpansRequest();

    const result = await getSpans({
      client: createTestClient(),
      project: { projectName: "test-project" },
    });

    expect(result.spans).toHaveLength(1);
    expect(result.spans[0]?.context.span_id).toBe("span-456");
    expect(result.spans[0]?.name).toBe("test-span");
    expect(result.nextCursor).toBe("next-cursor-123");
    expect(captured.projectIdentifier).toBe("test-project");
  });

  it("should get spans with all supported filter parameters", async () => {
    const captured = captureGetSpansRequest();

    const startTime = new Date("2022-01-01T00:00:00Z");
    const endTime = new Date("2022-01-02T00:00:00Z");

    const result = await getSpans({
      client: createTestClient(),
      project: { projectName: "test-project" },
      cursor: "cursor-123",
      limit: 50,
      startTime: startTime,
      endTime: endTime,
    });

    expect(result.spans).toHaveLength(1);
    expect(result.nextCursor).toBe("next-cursor-123");
    expect(captured.query?.get("cursor")).toBe("cursor-123");
    expect(captured.query?.get("limit")).toBe("50");
    expect(captured.query?.get("start_time")).toBe("2022-01-01T00:00:00.000Z");
    expect(captured.query?.get("end_time")).toBe("2022-01-02T00:00:00.000Z");
  });

  it("should get spans with string time parameters", async () => {
    const captured = captureGetSpansRequest();

    const result = await getSpans({
      client: createTestClient(),
      project: { projectName: "test-project" },
      startTime: "2022-01-01T00:00:00Z",
      endTime: "2022-01-02T00:00:00Z",
    });

    expect(result.spans).toHaveLength(1);
    expect(captured.query?.get("start_time")).toBe("2022-01-01T00:00:00Z");
    expect(captured.query?.get("end_time")).toBe("2022-01-02T00:00:00Z");
  });

  it("should handle pagination with cursor", async () => {
    const captured = captureGetSpansRequest();

    const result = await getSpans({
      client: createTestClient(),
      project: { projectName: "test-project" },
      cursor: "some-cursor-value",
      limit: 25,
    });

    expect(result.spans).toHaveLength(1);
    expect(captured.query?.get("cursor")).toBe("some-cursor-value");
    expect(captured.query?.get("limit")).toBe("25");
  });

  describe("filter parameters (name, spanKind, statusCode)", () => {
    it("should send name as array when given a single string", async () => {
      const captured = captureGetSpansRequest();

      await getSpans({
        client: createTestClient(),
        project: { projectName: "test-project" },
        name: "my-span",
      });

      expect(captured.query?.getAll("name")).toEqual(["my-span"]);
    });

    it("should send name as array when given an array", async () => {
      const captured = captureGetSpansRequest();

      await getSpans({
        client: createTestClient(),
        project: { projectName: "test-project" },
        name: ["span-a", "span-b"],
      });

      expect(captured.query?.getAll("name")).toEqual(["span-a", "span-b"]);
    });

    it("should send span_kind as array when given a single string", async () => {
      const captured = captureGetSpansRequest();

      await getSpans({
        client: createTestClient(),
        project: { projectName: "test-project" },
        spanKind: "LLM",
      });

      expect(captured.query?.getAll("span_kind")).toEqual(["LLM"]);
    });

    it("should send span_kind as array when given an array", async () => {
      const captured = captureGetSpansRequest();

      await getSpans({
        client: createTestClient(),
        project: { projectName: "test-project" },
        spanKind: ["LLM", "CHAIN"],
      });

      expect(captured.query?.getAll("span_kind")).toEqual(["LLM", "CHAIN"]);
    });

    it("should send status_code as array when given a single string", async () => {
      const captured = captureGetSpansRequest();

      await getSpans({
        client: createTestClient(),
        project: { projectName: "test-project" },
        statusCode: "ERROR",
      });

      expect(captured.query?.getAll("status_code")).toEqual(["ERROR"]);
    });

    it("should send status_code as array when given an array", async () => {
      const captured = captureGetSpansRequest();

      await getSpans({
        client: createTestClient(),
        project: { projectName: "test-project" },
        statusCode: ["OK", "ERROR"],
      });

      expect(captured.query?.getAll("status_code")).toEqual(["OK", "ERROR"]);
    });

    it("should not send filter params when undefined", async () => {
      const captured = captureGetSpansRequest();

      await getSpans({
        client: createTestClient(),
        project: { projectName: "test-project" },
      });

      expect(captured.query?.has("name")).toBe(false);
      expect(captured.query?.has("span_kind")).toBe(false);
      expect(captured.query?.has("status_code")).toBe(false);
    });
  });

  describe("attributes parameter", () => {
    it("should serialize a single attribute filter", async () => {
      const captured = captureGetSpansRequest();

      await getSpans({
        client: createTestClient(),
        project: { projectName: "test-project" },
        attributes: { "llm.model_name": "gpt-4" },
      });

      expect(captured.query?.getAll("attribute")).toEqual([
        "llm.model_name:gpt-4",
      ]);
    });

    it("should serialize multiple attribute filters", async () => {
      const captured = captureGetSpansRequest();

      await getSpans({
        client: createTestClient(),
        project: { projectName: "test-project" },
        attributes: {
          "llm.model_name": "gpt-4",
          "llm.provider": "openai",
        },
      });

      expect(captured.query?.getAll("attribute")).toEqual([
        "llm.model_name:gpt-4",
        "llm.provider:openai",
      ]);
    });

    it("should serialize numeric and boolean values without quotes", async () => {
      const captured = captureGetSpansRequest();

      await getSpans({
        client: createTestClient(),
        project: { projectName: "test-project" },
        attributes: {
          count: 42,
          cached: true,
        },
      });

      expect(captured.query?.getAll("attribute")).toEqual([
        "count:42",
        "cached:true",
      ]);
    });

    it("should quote string values that look like non-string JSON", async () => {
      const captured = captureGetSpansRequest();

      await getSpans({
        client: createTestClient(),
        project: { projectName: "test-project" },
        attributes: {
          cached: "true",
          count: "42",
        },
      });

      expect(captured.query?.getAll("attribute")).toEqual([
        'cached:"true"',
        'count:"42"',
      ]);
    });

    it("should quote empty string values", async () => {
      const captured = captureGetSpansRequest();

      await getSpans({
        client: createTestClient(),
        project: { projectName: "test-project" },
        attributes: {
          model: "",
        },
      });

      expect(captured.query?.getAll("attribute")).toEqual(['model:""']);
    });

    it("should not send attribute when attributes is undefined", async () => {
      const captured = captureGetSpansRequest();

      await getSpans({
        client: createTestClient(),
        project: { projectName: "test-project" },
      });

      expect(captured.query?.has("attribute")).toBe(false);
    });

    it("should omit attribute when attributes is an empty object", async () => {
      const captured = captureGetSpansRequest();

      await getSpans({
        client: createTestClient(),
        project: { projectName: "test-project" },
        attributes: {},
      });

      expect(captured.query?.has("attribute")).toBe(false);
    });

    it("should send attributes combined with other filters", async () => {
      const captured = captureGetSpansRequest();

      await getSpans({
        client: createTestClient(),
        project: { projectName: "test-project" },
        spanKind: "LLM",
        attributes: { "llm.model_name": "gpt-4" },
      });

      expect(captured.query?.getAll("span_kind")).toEqual(["LLM"]);
      expect(captured.query?.getAll("attribute")).toEqual([
        "llm.model_name:gpt-4",
      ]);
    });

    it("should reject non-finite numeric values", async () => {
      // Serialization fails client-side before any request is made.
      await expect(
        getSpans({
          client: createTestClient(),
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
      const captured = captureGetSpansRequest();

      await getSpans({
        client: createTestClient(),
        project: { projectName: "test-project" },
        parentId: "null",
      });

      expect(captured.query?.get("parent_id")).toBe("null");
    });

    it("should send parent_id with a span ID to get children", async () => {
      const captured = captureGetSpansRequest();

      await getSpans({
        client: createTestClient(),
        project: { projectName: "test-project" },
        parentId: "span-abc-123",
      });

      expect(captured.query?.get("parent_id")).toBe("span-abc-123");
    });

    it("should not send parent_id when parentId is undefined", async () => {
      const captured = captureGetSpansRequest();

      await getSpans({
        client: createTestClient(),
        project: { projectName: "test-project" },
      });

      expect(captured.query?.has("parent_id")).toBe(false);
    });

    it('should send parent_id="null" when parentId is JS null (root spans)', async () => {
      const captured = captureGetSpansRequest();

      await getSpans({
        client: createTestClient(),
        project: { projectName: "test-project" },
        parentId: null,
      });

      expect(captured.query?.get("parent_id")).toBe("null");
    });
  });
});

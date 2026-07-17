import { createHttp } from "@arizeai/phoenix-testing";
import { createMockServer, type Server } from "@arizeai/phoenix-testing/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { logTraceAnnotations } from "../../src/traces/logTraceAnnotations";
import { createTestClient } from "../testUtils";

const http = createHttp();

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

describe("logTraceAnnotations", () => {
  it("should log multiple trace annotations", async () => {
    let receivedRequestBody: unknown;

    server.use(
      http.post("/v1/trace_annotations", async ({ request, response }) => {
        receivedRequestBody = await request.json();
        return response(200).json({
          data: [{ id: "test-id-1" }, { id: "test-id-2" }],
        });
      })
    );

    const result = await logTraceAnnotations({
      client: createTestClient(),
      traceAnnotations: [
        {
          traceId: "abc123",
          name: "correctness",
          label: "correct",
          score: 1.0,
          annotatorKind: "HUMAN",
        },
        {
          traceId: "def456",
          name: "faithfulness",
          label: "faithful",
          score: 0.9,
          annotatorKind: "LLM",
        },
      ],
      sync: true,
    });

    expect(result).toEqual([{ id: "test-id-1" }, { id: "test-id-2" }]);
    expect(receivedRequestBody).toEqual({
      data: [
        {
          trace_id: "abc123",
          name: "correctness",
          annotator_kind: "HUMAN",
          result: { label: "correct", score: 1.0 },
          metadata: null,
          identifier: "",
        },
        {
          trace_id: "def456",
          name: "faithfulness",
          annotator_kind: "LLM",
          result: { label: "faithful", score: 0.9 },
          metadata: null,
          identifier: "",
        },
      ],
    });
  });

  it("should return empty array when sync=false (default)", async () => {
    server.use(
      http.post("/v1/trace_annotations", ({ response }) =>
        response(200).json({ data: [] })
      )
    );

    const result = await logTraceAnnotations({
      client: createTestClient(),
      traceAnnotations: [
        {
          traceId: "abc123",
          name: "correctness",
          label: "correct",
        },
      ],
    });

    expect(result).toEqual([]);
  });

  it("should throw when an annotation has no result fields", async () => {
    await expect(
      logTraceAnnotations({
        client: createTestClient(),
        traceAnnotations: [
          {
            traceId: "abc123",
            name: "correctness",
            label: "correct",
          },
          {
            traceId: "def456",
            name: "faithfulness",
          },
        ],
      })
    ).rejects.toThrow(
      "At least one of label, score, or explanation must be provided for trace annotation"
    );
  });
});

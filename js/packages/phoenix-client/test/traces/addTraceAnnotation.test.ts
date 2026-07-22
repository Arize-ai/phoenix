import { createHttp } from "@arizeai/phoenix-testing";
import { createMockServer, type Server } from "@arizeai/phoenix-testing/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { addTraceAnnotation } from "../../src/traces/addTraceAnnotation";
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

describe("addTraceAnnotation", () => {
  it("should add a trace annotation with all fields", async () => {
    let receivedSyncQuery: string | null = null;
    let receivedRequestBody: unknown;

    server.use(
      http.post("/v1/trace_annotations", async ({ request, response }) => {
        receivedSyncQuery = new URL(request.url).searchParams.get("sync");
        receivedRequestBody = await request.json();
        return response(200).json({ data: [{ id: "test-id-1" }] });
      })
    );

    const result = await addTraceAnnotation({
      client: createTestClient(),
      traceAnnotation: {
        traceId: "abc123",
        name: "correctness",
        label: "correct",
        score: 1.0,
        annotatorKind: "HUMAN",
        identifier: "test-identifier",
        metadata: { reviewer: "alice" },
      },
      sync: true,
    });

    expect(result).toEqual({ id: "test-id-1" });
    expect(receivedSyncQuery).toBe("true");
    expect(receivedRequestBody).toEqual({
      data: [
        {
          trace_id: "abc123",
          name: "correctness",
          annotator_kind: "HUMAN",
          result: { label: "correct", score: 1.0 },
          metadata: { reviewer: "alice" },
          identifier: "test-identifier",
        },
      ],
    });
  });

  it("should add a trace annotation with explanation only", async () => {
    server.use(
      http.post("/v1/trace_annotations", ({ response }) =>
        response(200).json({ data: [{ id: "test-id-1" }] })
      )
    );

    const result = await addTraceAnnotation({
      client: createTestClient(),
      traceAnnotation: {
        traceId: "abc123",
        name: "correctness",
        explanation: "Looks correct end-to-end",
        annotatorKind: "LLM",
      },
      sync: true,
    });

    expect(result).toEqual({ id: "test-id-1" });
  });

  it("should return null when sync=false (default)", async () => {
    let receivedSyncQuery: string | null = null;

    server.use(
      http.post("/v1/trace_annotations", ({ request, response }) => {
        receivedSyncQuery = new URL(request.url).searchParams.get("sync");
        return response(200).json({ data: [] });
      })
    );

    const result = await addTraceAnnotation({
      client: createTestClient(),
      traceAnnotation: {
        traceId: "abc123",
        name: "correctness",
        label: "correct",
      },
    });

    expect(result).toBeNull();
    expect(receivedSyncQuery).toBe("false");
  });

  it("should throw when no result fields are provided", async () => {
    await expect(
      addTraceAnnotation({
        client: createTestClient(),
        traceAnnotation: {
          traceId: "abc123",
          name: "correctness",
        },
      })
    ).rejects.toThrow(
      "At least one of label, score, or explanation must be provided for trace annotation"
    );
  });

  it("should reject the reserved name 'note'", async () => {
    await expect(
      addTraceAnnotation({
        client: createTestClient(),
        traceAnnotation: {
          traceId: "abc123",
          name: "note",
          label: "anything",
        },
      })
    ).rejects.toThrow(/reserved for trace and span notes/);
  });
});

import { createHttp } from "@arizeai/phoenix-testing";
import { createMockServer, type Server } from "@arizeai/phoenix-testing/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { addSpanAnnotation } from "../../src/spans/addSpanAnnotation";
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

describe("addSpanAnnotation", () => {
  it("should add a span annotation with all fields", async () => {
    let receivedSyncQueryParam: string | null = null;
    let receivedRequestBody: unknown;

    server.use(
      http.post("/v1/span_annotations", async ({ request, response }) => {
        receivedSyncQueryParam = new URL(request.url).searchParams.get("sync");
        receivedRequestBody = await request.json();
        return response(200).json({ data: [{ id: "test-id-1" }] });
      })
    );

    const result = await addSpanAnnotation({
      client: createTestClient(),
      spanAnnotation: {
        spanId: "123abc",
        name: "quality_score",
        label: "good",
        score: 0.95,
        annotatorKind: "LLM",
        identifier: "test-identifier",
        metadata: { source: "test" },
      },
      sync: true,
    });

    expect(result).toEqual({ id: "test-id-1" });
    expect(receivedSyncQueryParam).toBe("true");
    expect(receivedRequestBody).toEqual({
      data: [
        {
          span_id: "123abc",
          name: "quality_score",
          annotator_kind: "LLM",
          result: {
            label: "good",
            score: 0.95,
          },
          metadata: { source: "test" },
          identifier: "test-identifier",
        },
      ],
    });
  });

  it("should add a span annotation with explanation", async () => {
    server.use(
      http.post("/v1/span_annotations", ({ response }) =>
        response(200).json({ data: [{ id: "test-id-1" }] })
      )
    );

    const result = await addSpanAnnotation({
      client: createTestClient(),
      spanAnnotation: {
        spanId: "123abc",
        name: "quality_score",
        explanation: "This is a detailed explanation",
        annotatorKind: "LLM",
      },
      sync: true,
    });

    expect(result).toEqual({ id: "test-id-1" });
  });

  it("should add a span annotation with minimum required fields", async () => {
    server.use(
      http.post("/v1/span_annotations", ({ response }) =>
        response(200).json({ data: [{ id: "test-id-1" }] })
      )
    );

    const result = await addSpanAnnotation({
      client: createTestClient(),
      spanAnnotation: {
        spanId: "123abc",
        name: "quality_score",
        label: "good", // Now required - at least one result field needed
      },
      sync: true,
    });

    expect(result).toEqual({ id: "test-id-1" });
  });

  it("should return null when sync=false (default)", async () => {
    let receivedSyncQueryParam: string | null = null;

    server.use(
      http.post("/v1/span_annotations", ({ request, response }) => {
        receivedSyncQueryParam = new URL(request.url).searchParams.get("sync");
        // The server returns no inserted IDs for asynchronous inserts.
        return response(200).json({ data: [] });
      })
    );

    const result = await addSpanAnnotation({
      client: createTestClient(),
      spanAnnotation: {
        spanId: "123abc",
        name: "quality_score",
        label: "good",
      },
      // sync defaults to false
    });

    expect(result).toBeNull();
    expect(receivedSyncQueryParam).toBe("false");
  });

  it("should throw error when no result fields are provided", async () => {
    // Validation fails client-side before any request is made.
    await expect(
      addSpanAnnotation({
        client: createTestClient(),
        spanAnnotation: {
          spanId: "123abc",
          name: "quality_score",
          // No label, score, or explanation provided
        },
      })
    ).rejects.toThrow(
      "At least one of label, score, or explanation must be provided for span annotation"
    );
  });
});

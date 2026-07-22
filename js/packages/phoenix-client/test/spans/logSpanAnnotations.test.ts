import { createHttp } from "@arizeai/phoenix-testing";
import { createMockServer, type Server } from "@arizeai/phoenix-testing/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { logSpanAnnotations } from "../../src/spans/logSpanAnnotations";
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

describe("logSpanAnnotations", () => {
  it("should log multiple span annotations", async () => {
    let receivedSyncQueryParam: string | null = null;
    let receivedRequestBody: unknown;

    server.use(
      http.post("/v1/span_annotations", async ({ request, response }) => {
        receivedSyncQueryParam = new URL(request.url).searchParams.get("sync");
        receivedRequestBody = await request.json();
        return response(200).json({
          data: [{ id: "test-id-1" }, { id: "test-id-2" }],
        });
      })
    );

    const result = await logSpanAnnotations({
      client: createTestClient(),
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
          metadata: null,
          identifier: "",
        },
        {
          span_id: "456def",
          name: "sentiment",
          annotator_kind: "CODE",
          result: {
            label: "positive",
            score: 0.8,
          },
          metadata: null,
          identifier: "",
        },
      ],
    });
  });

  it("should handle mixed annotation types including explanations", async () => {
    server.use(
      http.post("/v1/span_annotations", ({ response }) =>
        response(200).json({
          data: [{ id: "test-id-1" }, { id: "test-id-2" }],
        })
      )
    );

    const result = await logSpanAnnotations({
      client: createTestClient(),
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
          explanation: "Positive sentiment detected in the text",
          annotatorKind: "CODE",
        },
      ],
      sync: true,
    });

    expect(result).toEqual([{ id: "test-id-1" }, { id: "test-id-2" }]);
  });

  it("should return empty array when sync=false (default)", async () => {
    let receivedSyncQueryParam: string | null = null;

    server.use(
      http.post("/v1/span_annotations", ({ request, response }) => {
        receivedSyncQueryParam = new URL(request.url).searchParams.get("sync");
        // The server returns no inserted IDs for asynchronous inserts.
        return response(200).json({ data: [] });
      })
    );

    const result = await logSpanAnnotations({
      client: createTestClient(),
      spanAnnotations: [
        {
          spanId: "123abc",
          name: "quality_score",
          label: "good",
        },
      ],
      // sync defaults to false
    });

    expect(result).toEqual([]);
    expect(receivedSyncQueryParam).toBe("false");
  });

  it("should throw error when annotation has no result fields", async () => {
    // Validation fails client-side before any request is made.
    await expect(
      logSpanAnnotations({
        client: createTestClient(),
        spanAnnotations: [
          {
            spanId: "123abc",
            name: "quality_score",
            label: "good", // This one is valid
          },
          {
            spanId: "456def",
            name: "sentiment_score",
            // No label, score, or explanation - should fail
          },
        ],
      })
    ).rejects.toThrow(
      "At least one of label, score, or explanation must be provided for span annotation"
    );
  });
});

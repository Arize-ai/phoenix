import { createHttp } from "@arizeai/phoenix-testing";
import { createMockServer, type Server } from "@arizeai/phoenix-testing/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { logDocumentAnnotations } from "../../src/spans/logDocumentAnnotations";
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

describe("logDocumentAnnotations", () => {
  it("should log multiple document annotations", async () => {
    let receivedSyncQueryParam: string | null = null;
    let receivedRequestBody: unknown;

    server.use(
      http.post("/v1/document_annotations", async ({ request, response }) => {
        receivedSyncQueryParam = new URL(request.url).searchParams.get("sync");
        receivedRequestBody = await request.json();
        return response(200).json({
          data: [{ id: "test-doc-id-1" }, { id: "test-doc-id-2" }],
        });
      })
    );

    const result = await logDocumentAnnotations({
      client: createTestClient(),
      documentAnnotations: [
        {
          spanId: "123abc",
          documentPosition: 0,
          name: "relevance_score",
          label: "relevant",
          score: 0.95,
          explanation: "Document is highly relevant to the query",
          annotatorKind: "LLM",
          metadata: { model: "gpt-4" },
        },
        {
          spanId: "123abc",
          documentPosition: 1,
          name: "relevance_score",
          label: "somewhat_relevant",
          score: 0.6,
          annotatorKind: "CODE",
        },
      ],
      sync: true,
    });

    expect(result).toEqual([{ id: "test-doc-id-1" }, { id: "test-doc-id-2" }]);
    expect(receivedSyncQueryParam).toBe("true");
    expect(receivedRequestBody).toEqual({
      data: [
        {
          span_id: "123abc",
          document_position: 0,
          name: "relevance_score",
          annotator_kind: "LLM",
          result: {
            label: "relevant",
            score: 0.95,
            explanation: "Document is highly relevant to the query",
          },
          metadata: { model: "gpt-4" },
        },
        {
          span_id: "123abc",
          document_position: 1,
          name: "relevance_score",
          annotator_kind: "CODE",
          result: {
            label: "somewhat_relevant",
            score: 0.6,
          },
          metadata: null,
        },
      ],
    });
  });

  it("should log document annotations with different annotation types", async () => {
    server.use(
      http.post("/v1/document_annotations", ({ response }) =>
        response(200).json({
          data: [{ id: "test-doc-id-1" }, { id: "test-doc-id-2" }],
        })
      )
    );

    const result = await logDocumentAnnotations({
      client: createTestClient(),
      documentAnnotations: [
        {
          spanId: "123abc",
          documentPosition: 0,
          name: "relevance_score",
          score: 0.95,
          annotatorKind: "LLM",
        },
        {
          spanId: "456def",
          documentPosition: 0,
          name: "quality",
          label: "high",
          annotatorKind: "HUMAN",
        },
        {
          spanId: "789ghi",
          documentPosition: 2,
          name: "sentiment",
          explanation: "Positive sentiment detected",
          annotatorKind: "CODE",
        },
      ],
      sync: true,
    });

    expect(result).toEqual([{ id: "test-doc-id-1" }, { id: "test-doc-id-2" }]);
  });

  it("should handle document annotations for different spans and positions", async () => {
    server.use(
      http.post("/v1/document_annotations", ({ response }) =>
        response(200).json({
          data: [{ id: "test-doc-id-1" }, { id: "test-doc-id-2" }],
        })
      )
    );

    const result = await logDocumentAnnotations({
      client: createTestClient(),
      documentAnnotations: [
        {
          spanId: "span1",
          documentPosition: 0,
          name: "relevance",
          label: "relevant",
        },
        {
          spanId: "span1",
          documentPosition: 1,
          name: "relevance",
          label: "not_relevant",
        },
        {
          spanId: "span2",
          documentPosition: 0,
          name: "quality",
          score: 0.8,
        },
      ],
      sync: true,
    });

    expect(result).toEqual([{ id: "test-doc-id-1" }, { id: "test-doc-id-2" }]);
  });

  it("should throw error when annotation has no result fields", async () => {
    // Validation fails client-side before any request is made.
    await expect(
      logDocumentAnnotations({
        client: createTestClient(),
        documentAnnotations: [
          {
            spanId: "123abc",
            documentPosition: 0,
            name: "relevance_score",
            label: "relevant", // This one is valid
          },
          {
            spanId: "456def",
            documentPosition: 1,
            name: "quality_score",
            // No label, score, or explanation - should fail
          },
        ],
      })
    ).rejects.toThrow(
      "At least one of label, score, or explanation must be provided for document annotation"
    );
  });

  it("should trim whitespace from string fields", async () => {
    let receivedRequestBody: unknown;

    server.use(
      http.post("/v1/document_annotations", async ({ request, response }) => {
        receivedRequestBody = await request.json();
        return response(200).json({
          data: [{ id: "test-doc-id-1" }, { id: "test-doc-id-2" }],
        });
      })
    );

    const result = await logDocumentAnnotations({
      client: createTestClient(),
      documentAnnotations: [
        {
          spanId: "  123abc  ",
          documentPosition: 0,
          name: "  relevance_score  ",
          label: "  relevant  ",
          explanation: "  Good document  ",
        },
      ],
      sync: true,
    });

    expect(result).toEqual([{ id: "test-doc-id-1" }, { id: "test-doc-id-2" }]);
    expect(receivedRequestBody).toEqual({
      data: [
        {
          span_id: "123abc",
          document_position: 0,
          name: "relevance_score",
          annotator_kind: "HUMAN",
          result: {
            label: "relevant",
            explanation: "Good document",
          },
          metadata: null,
        },
      ],
    });
  });

  it("should return empty array when sync=false (default)", async () => {
    let receivedSyncQueryParam: string | null = null;

    server.use(
      http.post("/v1/document_annotations", ({ request, response }) => {
        receivedSyncQueryParam = new URL(request.url).searchParams.get("sync");
        // The server returns no inserted IDs for asynchronous inserts.
        return response(200).json({ data: [] });
      })
    );

    const result = await logDocumentAnnotations({
      client: createTestClient(),
      documentAnnotations: [
        {
          spanId: "123abc",
          documentPosition: 0,
          name: "relevance_score",
          label: "relevant",
        },
      ],
      // sync defaults to false
    });

    expect(result).toEqual([]);
    expect(receivedSyncQueryParam).toBe("false");
  });
});

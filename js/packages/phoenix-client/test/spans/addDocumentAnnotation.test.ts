import { createHttp } from "@arizeai/phoenix-testing";
import { createMockServer, type Server } from "@arizeai/phoenix-testing/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { addDocumentAnnotation } from "../../src/spans/addDocumentAnnotation";
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

describe("addDocumentAnnotation", () => {
  it("should add a document annotation with all fields", async () => {
    let receivedSyncQueryParam: string | null = null;
    let receivedRequestBody: unknown;

    server.use(
      http.post("/v1/document_annotations", async ({ request, response }) => {
        receivedSyncQueryParam = new URL(request.url).searchParams.get("sync");
        receivedRequestBody = await request.json();
        return response(200).json({ data: [{ id: "test-doc-id-1" }] });
      })
    );

    const result = await addDocumentAnnotation({
      client: createTestClient(),
      documentAnnotation: {
        spanId: "123abc",
        documentPosition: 0,
        name: "relevance_score",
        label: "relevant",
        score: 0.95,
        explanation: "Document is highly relevant to the query",
        annotatorKind: "LLM",
        metadata: { model: "gpt-4" },
      },
      sync: true,
    });

    expect(result).toEqual({ id: "test-doc-id-1" });
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
      ],
    });
  });

  it("should add a document annotation with only required fields and label", async () => {
    server.use(
      http.post("/v1/document_annotations", ({ response }) =>
        response(200).json({ data: [{ id: "test-doc-id-1" }] })
      )
    );

    const result = await addDocumentAnnotation({
      client: createTestClient(),
      documentAnnotation: {
        spanId: "123abc",
        documentPosition: 1,
        name: "relevance_score",
        label: "relevant",
      },
      sync: true,
    });

    expect(result).toEqual({ id: "test-doc-id-1" });
  });

  it("should add a document annotation with only required fields and score", async () => {
    server.use(
      http.post("/v1/document_annotations", ({ response }) =>
        response(200).json({ data: [{ id: "test-doc-id-1" }] })
      )
    );

    const result = await addDocumentAnnotation({
      client: createTestClient(),
      documentAnnotation: {
        spanId: "123abc",
        documentPosition: 0,
        name: "relevance_score",
        score: 0.8,
      },
      sync: true,
    });

    expect(result).toEqual({ id: "test-doc-id-1" });
  });

  it("should add a document annotation with only required fields and explanation", async () => {
    server.use(
      http.post("/v1/document_annotations", ({ response }) =>
        response(200).json({ data: [{ id: "test-doc-id-1" }] })
      )
    );

    const result = await addDocumentAnnotation({
      client: createTestClient(),
      documentAnnotation: {
        spanId: "123abc",
        documentPosition: 2,
        name: "relevance_score",
        explanation: "Document provides good context",
      },
      sync: true,
    });

    expect(result).toEqual({ id: "test-doc-id-1" });
  });

  it("should throw error when no result fields are provided", async () => {
    // Validation fails client-side before any request is made.
    await expect(
      addDocumentAnnotation({
        client: createTestClient(),
        documentAnnotation: {
          spanId: "123abc",
          documentPosition: 0,
          name: "relevance_score",
          // No label, score, or explanation provided
        },
      })
    ).rejects.toThrow(
      "At least one of label, score, or explanation must be provided for document annotation"
    );
  });

  it("should handle empty strings properly", async () => {
    // Validation fails client-side before any request is made.
    await expect(
      addDocumentAnnotation({
        client: createTestClient(),
        documentAnnotation: {
          spanId: "123abc",
          documentPosition: 0,
          name: "relevance_score",
          label: "",
          explanation: "   ",
          // Only empty/whitespace strings provided
        },
      })
    ).rejects.toThrow(
      "At least one of label, score, or explanation must be provided for document annotation"
    );
  });

  it("should default annotatorKind to HUMAN", async () => {
    let receivedRequestBody: unknown;

    server.use(
      http.post("/v1/document_annotations", async ({ request, response }) => {
        receivedRequestBody = await request.json();
        return response(200).json({ data: [{ id: "test-doc-id-1" }] });
      })
    );

    const result = await addDocumentAnnotation({
      client: createTestClient(),
      documentAnnotation: {
        spanId: "123abc",
        documentPosition: 0,
        name: "relevance_score",
        label: "relevant",
        // annotatorKind not specified
      },
      sync: true,
    });

    expect(result).toEqual({ id: "test-doc-id-1" });
    expect(receivedRequestBody).toEqual({
      data: [
        expect.objectContaining({
          annotator_kind: "HUMAN",
        }),
      ],
    });
  });

  it("should return null when sync=false (default)", async () => {
    let receivedSyncQueryParam: string | null = null;

    server.use(
      http.post("/v1/document_annotations", ({ request, response }) => {
        receivedSyncQueryParam = new URL(request.url).searchParams.get("sync");
        // The server returns no inserted IDs for asynchronous inserts.
        return response(200).json({ data: [] });
      })
    );

    const result = await addDocumentAnnotation({
      client: createTestClient(),
      documentAnnotation: {
        spanId: "123abc",
        documentPosition: 0,
        name: "relevance_score",
        label: "relevant",
      },
      // sync defaults to false
    });

    expect(result).toBeNull();
    expect(receivedSyncQueryParam).toBe("false");
  });
});

import { createHttp } from "@arizeai/phoenix-testing";
import { createMockServer, type Server } from "@arizeai/phoenix-testing/node";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";

// Capability-guard tests below exercise the real version checks, so undo the
// global no-op mock from test/setup.ts.
vi.unmock("../../src/utils/serverVersionUtils");

import { appendDatasetExamples } from "../../src/datasets/appendDatasetExamples";
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

type CapturedUploadRequest = {
  searchParams: URLSearchParams;
  body: unknown;
};

/**
 * Register a handler for the dataset upload endpoint that captures every
 * request and answers with a canned success payload.
 */
function captureUploadRequests(): CapturedUploadRequest[] {
  const uploadRequests: CapturedUploadRequest[] = [];
  server.use(
    http.post("/v1/datasets/upload", async ({ request, response }) => {
      uploadRequests.push({
        searchParams: new URL(request.url).searchParams,
        body: await request.json(),
      });
      return response(200).json({
        data: {
          dataset_id: "dataset-123",
          version_id: "version-456",
          num_created_examples: 0,
          num_updated_examples: 0,
          num_deleted_examples: 0,
        },
      });
    })
  );
  return uploadRequests;
}

/**
 * Register a handler that reports the given Phoenix server version and counts
 * how many times the version endpoint is hit.
 */
function stubServerVersion(version: string): { getRequestCount: () => number } {
  let requestCount = 0;
  server.use(
    http.get("/arize_phoenix_version", ({ response }) => {
      requestCount += 1;
      return response.untyped(new Response(version, { status: 200 }));
    })
  );
  return { getRequestCount: () => requestCount };
}

describe("appendDatasetExamples", () => {
  it("should append examples to a dataset by name", async () => {
    const uploadRequests = captureUploadRequests();

    const result = await appendDatasetExamples({
      client: createTestClient(),
      dataset: { datasetName: "test-dataset" },
      examples: [
        {
          input: { question: "What is AI?" },
          output: { answer: "Artificial Intelligence" },
        },
        {
          input: { question: "What is ML?" },
          output: { answer: "Machine Learning" },
        },
      ],
    });

    expect(uploadRequests).toHaveLength(1);
    expect(uploadRequests[0]?.searchParams.get("sync")).toBe("true");
    expect(uploadRequests[0]?.body).toEqual({
      name: "test-dataset",
      action: "append",
      inputs: [{ question: "What is AI?" }, { question: "What is ML?" }],
      outputs: [
        { answer: "Artificial Intelligence" },
        { answer: "Machine Learning" },
      ],
      metadata: [{}, {}],
      splits: [null, null],
    });

    expect(result).toEqual({
      datasetId: "dataset-123",
      versionId: "version-456",
    });
  });

  it("should append examples with span IDs", async () => {
    const uploadRequests = captureUploadRequests();

    const result = await appendDatasetExamples({
      client: createTestClient(),
      dataset: { datasetName: "test-dataset" },
      examples: [
        {
          input: { question: "What is AI?" },
          output: { answer: "Artificial Intelligence" },
          spanId: "span-abc123",
        },
        {
          input: { question: "What is ML?" },
          output: { answer: "Machine Learning" },
          spanId: "span-def456",
        },
      ],
    });

    expect(uploadRequests).toHaveLength(1);
    expect(uploadRequests[0]?.searchParams.get("sync")).toBe("true");
    expect(uploadRequests[0]?.body).toEqual({
      name: "test-dataset",
      action: "append",
      inputs: [{ question: "What is AI?" }, { question: "What is ML?" }],
      outputs: [
        { answer: "Artificial Intelligence" },
        { answer: "Machine Learning" },
      ],
      metadata: [{}, {}],
      splits: [null, null],
      span_ids: ["span-abc123", "span-def456"],
    });

    expect(result).toEqual({
      datasetId: "dataset-123",
      versionId: "version-456",
    });
  });

  it("should append examples with mixed span IDs (some null)", async () => {
    const uploadRequests = captureUploadRequests();

    await appendDatasetExamples({
      client: createTestClient(),
      dataset: { datasetName: "test-dataset" },
      examples: [
        {
          input: { question: "What is AI?" },
          output: { answer: "Artificial Intelligence" },
          spanId: "span-abc123",
        },
        {
          input: { question: "What is ML?" },
          output: { answer: "Machine Learning" },
          // No spanId
        },
        {
          input: { question: "What is DL?" },
          output: { answer: "Deep Learning" },
          spanId: null,
        },
      ],
    });

    expect(uploadRequests).toHaveLength(1);
    expect(uploadRequests[0]?.searchParams.get("sync")).toBe("true");
    expect(uploadRequests[0]?.body).toEqual({
      name: "test-dataset",
      action: "append",
      inputs: [
        { question: "What is AI?" },
        { question: "What is ML?" },
        { question: "What is DL?" },
      ],
      outputs: [
        { answer: "Artificial Intelligence" },
        { answer: "Machine Learning" },
        { answer: "Deep Learning" },
      ],
      metadata: [{}, {}, {}],
      splits: [null, null, null],
      span_ids: ["span-abc123", null, null],
    });
  });

  it("should not include span_ids when no examples have span IDs", async () => {
    const uploadRequests = captureUploadRequests();

    await appendDatasetExamples({
      client: createTestClient(),
      dataset: { datasetName: "test-dataset" },
      examples: [
        {
          input: { question: "What is AI?" },
          output: { answer: "Artificial Intelligence" },
        },
        {
          input: { question: "What is ML?" },
          output: { answer: "Machine Learning" },
          spanId: null,
        },
      ],
    });

    expect(uploadRequests[0]?.body).not.toHaveProperty("span_ids");
  });

  it("should append examples by dataset ID (fetches name first)", async () => {
    let receivedDatasetId: string | undefined;
    server.use(
      http.get("/v1/datasets/{id}", ({ params, response }) => {
        receivedDatasetId = params.id;
        return response(200).json({
          data: {
            id: "dataset-123",
            name: "fetched-dataset-name",
            description: "A test dataset",
            metadata: {},
            created_at: "2024-01-01T00:00:00Z",
            updated_at: "2024-01-01T00:00:00Z",
            example_count: 10,
          },
        });
      })
    );
    const uploadRequests = captureUploadRequests();

    await appendDatasetExamples({
      client: createTestClient(),
      dataset: { datasetId: "dataset-123" },
      examples: [
        {
          input: { question: "What is AI?" },
          output: { answer: "Artificial Intelligence" },
          spanId: "span-abc123",
        },
      ],
    });

    // Should have fetched dataset info first
    expect(receivedDatasetId).toBe("dataset-123");

    // Then appended with the fetched name
    expect(uploadRequests).toHaveLength(1);
    expect(uploadRequests[0]?.searchParams.get("sync")).toBe("true");
    expect(uploadRequests[0]?.body).toEqual({
      name: "fetched-dataset-name",
      action: "append",
      inputs: [{ question: "What is AI?" }],
      outputs: [{ answer: "Artificial Intelligence" }],
      metadata: [{}],
      splits: [null],
      span_ids: ["span-abc123"],
    });
  });

  it("should append examples with splits and span IDs", async () => {
    const uploadRequests = captureUploadRequests();

    await appendDatasetExamples({
      client: createTestClient(),
      dataset: { datasetName: "test-dataset" },
      examples: [
        {
          input: { question: "What is AI?" },
          output: { answer: "Artificial Intelligence" },
          splits: "train",
          spanId: "span-abc123",
        },
        {
          input: { question: "What is ML?" },
          output: { answer: "Machine Learning" },
          splits: ["test", "validation"],
          spanId: "span-def456",
        },
      ],
    });

    expect(uploadRequests).toHaveLength(1);
    expect(uploadRequests[0]?.searchParams.get("sync")).toBe("true");
    expect(uploadRequests[0]?.body).toEqual({
      name: "test-dataset",
      action: "append",
      inputs: [{ question: "What is AI?" }, { question: "What is ML?" }],
      outputs: [
        { answer: "Artificial Intelligence" },
        { answer: "Machine Learning" },
      ],
      metadata: [{}, {}],
      splits: ["train", ["test", "validation"]],
      span_ids: ["span-abc123", "span-def456"],
    });
  });

  it("should append examples with IDs", async () => {
    stubServerVersion("15.0.0");
    const uploadRequests = captureUploadRequests();

    await appendDatasetExamples({
      client: createTestClient(),
      dataset: { datasetName: "test-dataset" },
      examples: [
        {
          input: { question: "What is AI?" },
          output: { answer: "Artificial Intelligence" },
          id: "example-ai",
        },
        {
          input: { question: "What is ML?" },
          output: { answer: "Machine Learning" },
          id: "example-ml",
        },
      ],
    });

    expect(uploadRequests).toHaveLength(1);
    expect(uploadRequests[0]?.searchParams.get("sync")).toBe("true");
    expect(uploadRequests[0]?.body).toEqual({
      name: "test-dataset",
      action: "append",
      inputs: [{ question: "What is AI?" }, { question: "What is ML?" }],
      outputs: [
        { answer: "Artificial Intelligence" },
        { answer: "Machine Learning" },
      ],
      metadata: [{}, {}],
      splits: [null, null],
      example_ids: ["example-ai", "example-ml"],
    });
  });

  it("should append examples with mixed IDs (some null)", async () => {
    stubServerVersion("15.0.0");
    const uploadRequests = captureUploadRequests();

    await appendDatasetExamples({
      client: createTestClient(),
      dataset: { datasetName: "test-dataset" },
      examples: [
        {
          input: { question: "What is AI?" },
          id: "example-ai",
        },
        {
          input: { question: "What is ML?" },
          // No id
        },
        {
          input: { question: "What is DL?" },
          id: null,
        },
      ],
    });

    expect(uploadRequests[0]?.body).toEqual(
      expect.objectContaining({
        example_ids: ["example-ai", null, null],
      })
    );
  });

  it("should not include example_ids when no examples have IDs", async () => {
    const uploadRequests = captureUploadRequests();

    await appendDatasetExamples({
      client: createTestClient(),
      dataset: { datasetName: "test-dataset" },
      examples: [
        { input: { question: "What is AI?" } },
        { input: { question: "What is ML?" }, id: null },
      ],
    });

    expect(uploadRequests[0]?.body).not.toHaveProperty("example_ids");
  });

  it("should throw error when response data is missing", async () => {
    server.use(
      http.post("/v1/datasets/upload", ({ response }) =>
        response(200).json(null)
      )
    );

    await expect(
      appendDatasetExamples({
        client: createTestClient(),
        dataset: { datasetName: "test-dataset" },
        examples: [{ input: { question: "What is AI?" } }],
      })
    ).rejects.toThrow("Failed to append dataset examples");
  });

  it("should handle metadata in examples", async () => {
    const uploadRequests = captureUploadRequests();

    await appendDatasetExamples({
      client: createTestClient(),
      dataset: { datasetName: "test-dataset" },
      examples: [
        {
          input: { question: "What is AI?" },
          output: { answer: "Artificial Intelligence" },
          metadata: { source: "wikipedia", difficulty: "easy" },
          spanId: "span-abc123",
        },
      ],
    });

    expect(uploadRequests).toHaveLength(1);
    expect(uploadRequests[0]?.searchParams.get("sync")).toBe("true");
    expect(uploadRequests[0]?.body).toEqual({
      name: "test-dataset",
      action: "append",
      inputs: [{ question: "What is AI?" }],
      outputs: [{ answer: "Artificial Intelligence" }],
      metadata: [{ source: "wikipedia", difficulty: "easy" }],
      splits: [null],
      span_ids: ["span-abc123"],
    });
  });

  describe("server version gating for example_ids", () => {
    it("fails fast on Phoenix < 15.0.0 when an example carries a stable id", async () => {
      stubServerVersion("14.17.0");
      const uploadRequests = captureUploadRequests();

      await expect(
        appendDatasetExamples({
          client: createTestClient(),
          dataset: { datasetName: "ds" },
          examples: [{ input: { q: 1 }, id: "stable-id" }],
        })
      ).rejects.toThrow(/requires Phoenix server >= 15\.0\.0/);

      expect(uploadRequests).toHaveLength(0);
    });

    it("does not check server version when no example carries an id", async () => {
      const versionEndpoint = stubServerVersion("14.17.0");
      const uploadRequests = captureUploadRequests();

      await appendDatasetExamples({
        client: createTestClient(),
        dataset: { datasetName: "ds" },
        examples: [{ input: { q: 1 } }],
      });

      expect(versionEndpoint.getRequestCount()).toBe(0);
      expect(uploadRequests).toHaveLength(1);
    });

    it("succeeds on Phoenix >= 15.0.0 when examples carry ids", async () => {
      stubServerVersion("15.0.0");
      const uploadRequests = captureUploadRequests();

      await appendDatasetExamples({
        client: createTestClient(),
        dataset: { datasetName: "ds" },
        examples: [{ input: { q: 1 }, id: "stable-id" }],
      });

      expect(uploadRequests).toHaveLength(1);
    });
  });
});

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

import type { PhoenixClient } from "../../src/client";
import { createDataset } from "../../src/datasets/createDataset";
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

describe("createDataset", () => {
  it("should create a dataset with basic examples", async () => {
    const uploadRequests = captureUploadRequests();

    const result = await createDataset({
      client: createTestClient(),
      name: "test-dataset",
      description: "A test dataset",
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
      description: "A test dataset",
      action: "update",
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
    });
  });

  it("should create a dataset with span IDs", async () => {
    const uploadRequests = captureUploadRequests();

    const result = await createDataset({
      client: createTestClient(),
      name: "test-dataset",
      description: "A dataset with span links",
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
      description: "A dataset with span links",
      action: "update",
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
    });
  });

  it("should create a dataset with mixed span IDs (some null)", async () => {
    const uploadRequests = captureUploadRequests();

    await createDataset({
      client: createTestClient(),
      name: "test-dataset",
      description: "A dataset with partial span links",
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
      description: "A dataset with partial span links",
      action: "update",
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

    await createDataset({
      client: createTestClient(),
      name: "test-dataset",
      description: "A dataset without span links",
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

  it("should create a dataset with splits and span IDs", async () => {
    const uploadRequests = captureUploadRequests();

    await createDataset({
      client: createTestClient(),
      name: "test-dataset",
      description: "A dataset with splits and span links",
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
      description: "A dataset with splits and span links",
      action: "update",
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

  it("should handle metadata in examples", async () => {
    const uploadRequests = captureUploadRequests();

    await createDataset({
      client: createTestClient(),
      name: "test-dataset",
      description: "A dataset with metadata",
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
      description: "A dataset with metadata",
      action: "update",
      inputs: [{ question: "What is AI?" }],
      outputs: [{ answer: "Artificial Intelligence" }],
      metadata: [{ source: "wikipedia", difficulty: "easy" }],
      splits: [null],
      span_ids: ["span-abc123"],
    });
  });

  it("should create a dataset with IDs", async () => {
    stubServerVersion("15.0.0");
    const uploadRequests = captureUploadRequests();

    await createDataset({
      client: createTestClient(),
      name: "test-dataset",
      description: "A dataset with IDs",
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
      description: "A dataset with IDs",
      action: "update",
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

  it("should create a dataset with mixed IDs (some null)", async () => {
    stubServerVersion("15.0.0");
    const uploadRequests = captureUploadRequests();

    await createDataset({
      client: createTestClient(),
      name: "test-dataset",
      description: "A dataset with partial IDs",
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

    await createDataset({
      client: createTestClient(),
      name: "test-dataset",
      description: "A dataset without IDs",
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
      createDataset({
        client: createTestClient(),
        name: "test-dataset",
        description: "A test dataset",
        examples: [{ input: { question: "What is AI?" } }],
      })
    ).rejects.toThrow("Failed to create dataset");
  });

  it("should handle null output in examples", async () => {
    const uploadRequests = captureUploadRequests();

    await createDataset({
      client: createTestClient(),
      name: "test-dataset",
      description: "A dataset with null outputs",
      examples: [
        {
          input: { question: "What is AI?" },
          output: null,
          spanId: "span-abc123",
        },
      ],
    });

    expect(uploadRequests).toHaveLength(1);
    expect(uploadRequests[0]?.searchParams.get("sync")).toBe("true");
    expect(uploadRequests[0]?.body).toEqual({
      name: "test-dataset",
      description: "A dataset with null outputs",
      action: "update",
      inputs: [{ question: "What is AI?" }],
      outputs: [{}], // null is converted to empty object
      metadata: [{}],
      splits: [null],
      span_ids: ["span-abc123"],
    });
  });

  describe("fallback to action=create on unsupported server", () => {
    // The fallback inspects the `{ data, error, response }` result shape that
    // openapi-fetch returns when no middleware throws on non-2xx statuses.
    // Clients built by `createClient` throw an HttpError on non-2xx responses
    // before that shape is ever produced, so this branch is only reachable
    // with a caller-supplied client — stub one instead of using real HTTP.
    it("retries with action=create and warns when server returns 422 invalid-action", async () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const postMock = vi
        .fn()
        .mockResolvedValueOnce({
          data: null,
          error: "Invalid dateset action: update",
          response: new Response(null, { status: 422 }),
        })
        .mockResolvedValueOnce({
          data: { data: { dataset_id: "ds-1", version_id: "v-1" } },
          error: null,
          response: new Response(null, { status: 200 }),
        });
      const stubClient = { POST: postMock } as unknown as PhoenixClient;

      const result = await createDataset({
        client: stubClient,
        name: "test-dataset",
        description: "x",
        examples: [{ input: { q: 1 } }],
      });

      expect(postMock).toHaveBeenCalledTimes(2);
      expect(postMock.mock.calls[0]?.[1]?.body?.action).toBe("update");
      expect(postMock.mock.calls[1]?.[1]?.body?.action).toBe("create");
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("does not support declarative update semantics")
      );
      expect(result).toEqual({ datasetId: "ds-1" });

      warnSpy.mockRestore();
    });

    it("does not retry on unrelated 422 errors", async () => {
      const postMock = vi.fn().mockResolvedValueOnce({
        data: null,
        error: "inputs must be non-empty",
        response: new Response(null, { status: 422 }),
      });
      const stubClient = { POST: postMock } as unknown as PhoenixClient;

      await expect(
        createDataset({
          client: stubClient,
          name: "test-dataset",
          description: "x",
          examples: [{ input: { q: 1 } }],
        })
      ).rejects.toThrow();
      expect(postMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("server version gating for example_ids", () => {
    it("fails fast on Phoenix < 15.0.0 when an example carries a stable id", async () => {
      stubServerVersion("14.17.0");
      const uploadRequests = captureUploadRequests();

      await expect(
        createDataset({
          client: createTestClient(),
          name: "ds",
          description: "x",
          examples: [{ input: { q: 1 }, id: "stable-id" }],
        })
      ).rejects.toThrow(/requires Phoenix server >= 15\.0\.0/);

      expect(uploadRequests).toHaveLength(0);
    });

    it("does not check server version when no example carries an id", async () => {
      const versionEndpoint = stubServerVersion("14.17.0");
      const uploadRequests = captureUploadRequests();

      await createDataset({
        client: createTestClient(),
        name: "ds",
        description: "x",
        examples: [{ input: { q: 1 } }],
      });

      expect(versionEndpoint.getRequestCount()).toBe(0);
      expect(uploadRequests).toHaveLength(1);
    });

    it("succeeds on Phoenix >= 15.0.0 when examples carry ids", async () => {
      stubServerVersion("15.0.0");
      const uploadRequests = captureUploadRequests();

      await createDataset({
        client: createTestClient(),
        name: "ds",
        description: "x",
        examples: [{ input: { q: 1 }, id: "stable-id" }],
      });

      expect(uploadRequests).toHaveLength(1);
    });
  });
});

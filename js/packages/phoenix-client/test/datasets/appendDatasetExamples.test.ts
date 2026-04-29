import { beforeEach, describe, expect, it, vi } from "vitest";

vi.unmock("../../src/utils/serverVersionUtils");

import { appendDatasetExamples } from "../../src/datasets/appendDatasetExamples";

// Mock the fetch module
const mockPost = vi.fn();
const mockGet = vi.fn();
vi.mock("openapi-fetch", () => ({
  default: () => ({
    POST: mockPost,
    GET: mockGet,
    use: () => {},
  }),
}));

// Auto-created clients call `fetch("/arize_phoenix_version")` inside
// `getServerVersion()`. Stub it to a recent version so the example_ids gate
// succeeds for tests that don't supply their own client. Gating-specific tests
// pass a custom client and bypass this entirely.
vi.stubGlobal(
  "fetch",
  vi.fn(async () => new Response("15.0.0", { status: 200 }))
);

describe("appendDatasetExamples", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should append examples to a dataset by name", async () => {
    const mockResponse = {
      dataset_id: "dataset-123",
      version_id: "version-456",
    };

    mockPost.mockResolvedValue({
      data: { data: mockResponse },
      error: null,
    });

    const result = await appendDatasetExamples({
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

    expect(mockPost).toHaveBeenCalledWith("/v1/datasets/upload", {
      params: {
        query: {
          sync: true,
        },
      },
      body: {
        name: "test-dataset",
        action: "append",
        inputs: [{ question: "What is AI?" }, { question: "What is ML?" }],
        outputs: [
          { answer: "Artificial Intelligence" },
          { answer: "Machine Learning" },
        ],
        metadata: [{}, {}],
        splits: [null, null],
      },
    });

    expect(result).toEqual({
      datasetId: "dataset-123",
      versionId: "version-456",
    });
  });

  it("should append examples with span IDs", async () => {
    const mockResponse = {
      dataset_id: "dataset-123",
      version_id: "version-456",
    };

    mockPost.mockResolvedValue({
      data: { data: mockResponse },
      error: null,
    });

    const result = await appendDatasetExamples({
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

    expect(mockPost).toHaveBeenCalledWith("/v1/datasets/upload", {
      params: {
        query: {
          sync: true,
        },
      },
      body: {
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
      },
    });

    expect(result).toEqual({
      datasetId: "dataset-123",
      versionId: "version-456",
    });
  });

  it("should append examples with mixed span IDs (some null)", async () => {
    const mockResponse = {
      dataset_id: "dataset-123",
      version_id: "version-456",
    };

    mockPost.mockResolvedValue({
      data: { data: mockResponse },
      error: null,
    });

    await appendDatasetExamples({
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

    expect(mockPost).toHaveBeenCalledWith("/v1/datasets/upload", {
      params: {
        query: {
          sync: true,
        },
      },
      body: {
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
      },
    });
  });

  it("should not include span_ids when no examples have span IDs", async () => {
    const mockResponse = {
      dataset_id: "dataset-123",
      version_id: "version-456",
    };

    mockPost.mockResolvedValue({
      data: { data: mockResponse },
      error: null,
    });

    await appendDatasetExamples({
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

    const callBody = mockPost.mock.calls[0][1].body;
    expect(callBody).not.toHaveProperty("span_ids");
  });

  it("should append examples by dataset ID (fetches name first)", async () => {
    const mockDatasetInfo = {
      id: "dataset-123",
      name: "fetched-dataset-name",
      description: "A test dataset",
      metadata: {},
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
      example_count: 10,
    };

    mockGet.mockResolvedValue({
      data: { data: mockDatasetInfo },
      error: null,
    });

    const mockResponse = {
      dataset_id: "dataset-123",
      version_id: "version-456",
    };

    mockPost.mockResolvedValue({
      data: { data: mockResponse },
      error: null,
    });

    await appendDatasetExamples({
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
    expect(mockGet).toHaveBeenCalledWith("/v1/datasets/{id}", {
      params: {
        path: {
          id: "dataset-123",
        },
      },
    });

    // Then appended with the fetched name
    expect(mockPost).toHaveBeenCalledWith("/v1/datasets/upload", {
      params: {
        query: {
          sync: true,
        },
      },
      body: {
        name: "fetched-dataset-name",
        action: "append",
        inputs: [{ question: "What is AI?" }],
        outputs: [{ answer: "Artificial Intelligence" }],
        metadata: [{}],
        splits: [null],
        span_ids: ["span-abc123"],
      },
    });
  });

  it("should append examples with splits and span IDs", async () => {
    const mockResponse = {
      dataset_id: "dataset-123",
      version_id: "version-456",
    };

    mockPost.mockResolvedValue({
      data: { data: mockResponse },
      error: null,
    });

    await appendDatasetExamples({
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

    expect(mockPost).toHaveBeenCalledWith("/v1/datasets/upload", {
      params: {
        query: {
          sync: true,
        },
      },
      body: {
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
      },
    });
  });

  it("should append examples with IDs", async () => {
    const mockResponse = {
      dataset_id: "dataset-123",
      version_id: "version-456",
    };

    mockPost.mockResolvedValue({
      data: { data: mockResponse },
      error: null,
    });

    await appendDatasetExamples({
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

    expect(mockPost).toHaveBeenCalledWith("/v1/datasets/upload", {
      params: { query: { sync: true } },
      body: {
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
      },
    });
  });

  it("should append examples with mixed IDs (some null)", async () => {
    const mockResponse = {
      dataset_id: "dataset-123",
      version_id: "version-456",
    };

    mockPost.mockResolvedValue({
      data: { data: mockResponse },
      error: null,
    });

    await appendDatasetExamples({
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

    expect(mockPost).toHaveBeenCalledWith("/v1/datasets/upload", {
      params: { query: { sync: true } },
      body: expect.objectContaining({
        example_ids: ["example-ai", null, null],
      }),
    });
  });

  it("should not include example_ids when no examples have IDs", async () => {
    const mockResponse = {
      dataset_id: "dataset-123",
      version_id: "version-456",
    };

    mockPost.mockResolvedValue({
      data: { data: mockResponse },
      error: null,
    });

    await appendDatasetExamples({
      dataset: { datasetName: "test-dataset" },
      examples: [
        { input: { question: "What is AI?" } },
        { input: { question: "What is ML?" }, id: null },
      ],
    });

    const callBody = mockPost.mock.calls[0][1].body;
    expect(callBody).not.toHaveProperty("example_ids");
  });

  it("should throw error when response data is missing", async () => {
    mockPost.mockResolvedValue({
      data: null,
      error: null,
    });

    await expect(
      appendDatasetExamples({
        dataset: { datasetName: "test-dataset" },
        examples: [{ input: { question: "What is AI?" } }],
      })
    ).rejects.toThrow("Failed to append dataset examples");
  });

  it("should handle metadata in examples", async () => {
    const mockResponse = {
      dataset_id: "dataset-123",
      version_id: "version-456",
    };

    mockPost.mockResolvedValue({
      data: { data: mockResponse },
      error: null,
    });

    await appendDatasetExamples({
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

    expect(mockPost).toHaveBeenCalledWith("/v1/datasets/upload", {
      params: {
        query: {
          sync: true,
        },
      },
      body: {
        name: "test-dataset",
        action: "append",
        inputs: [{ question: "What is AI?" }],
        outputs: [{ answer: "Artificial Intelligence" }],
        metadata: [{ source: "wikipedia", difficulty: "easy" }],
        splits: [null],
        span_ids: ["span-abc123"],
      },
    });
  });

  describe("server version gating for example_ids", () => {
    function makeClient(version: [number, number, number]) {
      return {
        getServerVersion: async () => version,
        POST: mockPost,
      };
    }

    it("fails fast on Phoenix < 15.0.0 when an example carries a stable id", async () => {
      await expect(
        appendDatasetExamples({
          client: makeClient([14, 17, 0]) as never,
          dataset: { datasetName: "ds" },
          examples: [{ input: { q: 1 }, id: "stable-id" }],
        })
      ).rejects.toThrow(/requires Phoenix server >= 15\.0\.0/);

      expect(mockPost).not.toHaveBeenCalled();
    });

    it("does not check server version when no example carries an id", async () => {
      const client = makeClient([14, 17, 0]);
      const getServerVersionSpy = vi.spyOn(client, "getServerVersion");

      await appendDatasetExamples({
        client: client as never,
        dataset: { datasetName: "ds" },
        examples: [{ input: { q: 1 } }],
      });

      expect(getServerVersionSpy).not.toHaveBeenCalled();
      expect(mockPost).toHaveBeenCalled();
    });

    it("succeeds on Phoenix >= 15.0.0 when examples carry ids", async () => {
      await appendDatasetExamples({
        client: makeClient([15, 0, 0]) as never,
        dataset: { datasetName: "ds" },
        examples: [{ input: { q: 1 }, id: "stable-id" }],
      });

      expect(mockPost).toHaveBeenCalled();
    });
  });
});

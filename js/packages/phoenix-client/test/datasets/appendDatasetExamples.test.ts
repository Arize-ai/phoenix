import { appendDatasetExamples } from "../../src/datasets/appendDatasetExamples";

import { beforeEach, describe, expect, it, vi } from "vitest";

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
});

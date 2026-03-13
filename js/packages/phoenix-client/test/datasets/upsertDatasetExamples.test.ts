import { beforeEach, describe, expect, it, vi } from "vitest";

import { upsertDatasetExamples } from "../../src/datasets/upsertDatasetExamples";

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

describe("upsertDatasetExamples", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should upsert examples to a dataset by name", async () => {
    const mockResponse = {
      dataset_id: "dataset-123",
      version_id: "version-456",
    };

    mockPost.mockResolvedValue({
      data: { data: mockResponse },
      error: null,
    });

    const result = await upsertDatasetExamples({
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
        action: "upsert",
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

  it("should upsert examples by dataset ID (fetches name first)", async () => {
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

    const result = await upsertDatasetExamples({
      dataset: { datasetId: "dataset-123" },
      examples: [
        {
          input: { question: "What is AI?" },
          output: { answer: "Artificial Intelligence" },
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

    // Then upserted with the fetched name
    expect(mockPost).toHaveBeenCalledWith("/v1/datasets/upload", {
      params: {
        query: {
          sync: true,
        },
      },
      body: {
        name: "fetched-dataset-name",
        action: "upsert",
        inputs: [{ question: "What is AI?" }],
        outputs: [{ answer: "Artificial Intelligence" }],
        metadata: [{}],
        splits: [null],
      },
    });

    expect(result).toEqual({
      datasetId: "dataset-123",
      versionId: "version-456",
    });
  });

  it("should upsert examples with external IDs", async () => {
    const mockResponse = {
      dataset_id: "dataset-123",
      version_id: "version-456",
    };

    mockPost.mockResolvedValue({
      data: { data: mockResponse },
      error: null,
    });

    await upsertDatasetExamples({
      dataset: { datasetName: "test-dataset" },
      examples: [
        {
          input: { question: "What is AI?" },
          output: { answer: "Artificial Intelligence" },
          externalId: "ai-question",
        },
        {
          input: { question: "What is ML?" },
          output: { answer: "Machine Learning" },
          externalId: "ml-question",
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
        action: "upsert",
        inputs: [{ question: "What is AI?" }, { question: "What is ML?" }],
        outputs: [
          { answer: "Artificial Intelligence" },
          { answer: "Machine Learning" },
        ],
        metadata: [{}, {}],
        splits: [null, null],
        external_ids: ["ai-question", "ml-question"],
      },
    });
  });

  it("should upsert examples with mixed external IDs (some null)", async () => {
    const mockResponse = {
      dataset_id: "dataset-123",
      version_id: "version-456",
    };

    mockPost.mockResolvedValue({
      data: { data: mockResponse },
      error: null,
    });

    await upsertDatasetExamples({
      dataset: { datasetName: "test-dataset" },
      examples: [
        {
          input: { question: "What is AI?" },
          output: { answer: "Artificial Intelligence" },
          externalId: "ai-question",
        },
        {
          input: { question: "What is ML?" },
          output: { answer: "Machine Learning" },
          // No externalId
        },
        {
          input: { question: "What is DL?" },
          output: { answer: "Deep Learning" },
          externalId: null,
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
        action: "upsert",
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
        external_ids: ["ai-question", null, null],
      },
    });
  });

  it("should not include external_ids when no examples have external IDs", async () => {
    const mockResponse = {
      dataset_id: "dataset-123",
      version_id: "version-456",
    };

    mockPost.mockResolvedValue({
      data: { data: mockResponse },
      error: null,
    });

    await upsertDatasetExamples({
      dataset: { datasetName: "test-dataset" },
      examples: [
        {
          input: { question: "What is AI?" },
          output: { answer: "Artificial Intelligence" },
        },
        {
          input: { question: "What is ML?" },
          output: { answer: "Machine Learning" },
          externalId: null,
        },
      ],
    });

    const callBody = mockPost.mock.calls[0][1].body;
    expect(callBody).not.toHaveProperty("external_ids");
  });

  it("should upsert examples with span IDs and external IDs", async () => {
    const mockResponse = {
      dataset_id: "dataset-123",
      version_id: "version-456",
    };

    mockPost.mockResolvedValue({
      data: { data: mockResponse },
      error: null,
    });

    await upsertDatasetExamples({
      dataset: { datasetName: "test-dataset" },
      examples: [
        {
          input: { question: "What is AI?" },
          output: { answer: "Artificial Intelligence" },
          spanId: "span-abc123",
          externalId: "ai-question",
        },
        {
          input: { question: "What is ML?" },
          output: { answer: "Machine Learning" },
          spanId: "span-def456",
          externalId: "ml-question",
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
        action: "upsert",
        inputs: [{ question: "What is AI?" }, { question: "What is ML?" }],
        outputs: [
          { answer: "Artificial Intelligence" },
          { answer: "Machine Learning" },
        ],
        metadata: [{}, {}],
        splits: [null, null],
        span_ids: ["span-abc123", "span-def456"],
        external_ids: ["ai-question", "ml-question"],
      },
    });
  });

  it("should include description when provided", async () => {
    const mockResponse = {
      dataset_id: "dataset-123",
      version_id: "version-456",
    };

    mockPost.mockResolvedValue({
      data: { data: mockResponse },
      error: null,
    });

    await upsertDatasetExamples({
      dataset: { datasetName: "test-dataset" },
      description: "A trivia dataset",
      examples: [
        {
          input: { question: "What is AI?" },
          output: { answer: "Artificial Intelligence" },
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
        description: "A trivia dataset",
        action: "upsert",
        inputs: [{ question: "What is AI?" }],
        outputs: [{ answer: "Artificial Intelligence" }],
        metadata: [{}],
        splits: [null],
      },
    });
  });

  it("should not include description when not provided", async () => {
    const mockResponse = {
      dataset_id: "dataset-123",
      version_id: "version-456",
    };

    mockPost.mockResolvedValue({
      data: { data: mockResponse },
      error: null,
    });

    await upsertDatasetExamples({
      dataset: { datasetName: "test-dataset" },
      examples: [
        {
          input: { question: "What is AI?" },
          output: { answer: "Artificial Intelligence" },
        },
      ],
    });

    const callBody = mockPost.mock.calls[0][1].body;
    expect(callBody).not.toHaveProperty("description");
  });

  it("should throw error when response data is missing", async () => {
    mockPost.mockResolvedValue({
      data: null,
      error: null,
    });

    await expect(
      upsertDatasetExamples({
        dataset: { datasetName: "test-dataset" },
        examples: [{ input: { question: "What is AI?" } }],
      })
    ).rejects.toThrow("Failed to upsert dataset examples");
  });

  it("should upsert examples with all fields combined", async () => {
    const mockResponse = {
      dataset_id: "dataset-123",
      version_id: "version-456",
    };

    mockPost.mockResolvedValue({
      data: { data: mockResponse },
      error: null,
    });

    const result = await upsertDatasetExamples({
      dataset: { datasetName: "test-dataset" },
      description: "Full-featured dataset",
      examples: [
        {
          input: { question: "What is AI?" },
          output: { answer: "Artificial Intelligence" },
          metadata: { source: "wikipedia", difficulty: "easy" },
          splits: "train",
          spanId: "span-abc123",
          externalId: "ai-question",
        },
        {
          input: { question: "What is ML?" },
          output: { answer: "Machine Learning" },
          metadata: { source: "textbook" },
          splits: ["test", "validation"],
          spanId: "span-def456",
          externalId: "ml-question",
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
        description: "Full-featured dataset",
        action: "upsert",
        inputs: [{ question: "What is AI?" }, { question: "What is ML?" }],
        outputs: [
          { answer: "Artificial Intelligence" },
          { answer: "Machine Learning" },
        ],
        metadata: [
          { source: "wikipedia", difficulty: "easy" },
          { source: "textbook" },
        ],
        splits: ["train", ["test", "validation"]],
        span_ids: ["span-abc123", "span-def456"],
        external_ids: ["ai-question", "ml-question"],
      },
    });

    expect(result).toEqual({
      datasetId: "dataset-123",
      versionId: "version-456",
    });
  });
});

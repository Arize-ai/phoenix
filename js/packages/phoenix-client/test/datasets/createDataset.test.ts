import { createDataset } from "../../src/datasets/createDataset";

import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the fetch module
const mockPost = vi.fn();
vi.mock("openapi-fetch", () => ({
  default: () => ({
    POST: mockPost,
    use: () => {},
  }),
}));

describe("createDataset", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create a dataset with basic examples", async () => {
    const mockResponse = {
      dataset_id: "dataset-123",
      version_id: "version-456",
    };

    mockPost.mockResolvedValue({
      data: { data: mockResponse },
      error: null,
    });

    const result = await createDataset({
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

    expect(mockPost).toHaveBeenCalledWith("/v1/datasets/upload", {
      params: {
        query: {
          sync: true,
        },
      },
      body: {
        name: "test-dataset",
        description: "A test dataset",
        action: "create",
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

  it("should create a dataset with span IDs", async () => {
    const mockResponse = {
      dataset_id: "dataset-123",
      version_id: "version-456",
    };

    mockPost.mockResolvedValue({
      data: { data: mockResponse },
      error: null,
    });

    const result = await createDataset({
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

    expect(mockPost).toHaveBeenCalledWith("/v1/datasets/upload", {
      params: {
        query: {
          sync: true,
        },
      },
      body: {
        name: "test-dataset",
        description: "A dataset with span links",
        action: "create",
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

  it("should create a dataset with mixed span IDs (some null)", async () => {
    const mockResponse = {
      dataset_id: "dataset-123",
      version_id: "version-456",
    };

    mockPost.mockResolvedValue({
      data: { data: mockResponse },
      error: null,
    });

    await createDataset({
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

    expect(mockPost).toHaveBeenCalledWith("/v1/datasets/upload", {
      params: {
        query: {
          sync: true,
        },
      },
      body: {
        name: "test-dataset",
        description: "A dataset with partial span links",
        action: "create",
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

    await createDataset({
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

    const callBody = mockPost.mock.calls[0][1].body;
    expect(callBody).not.toHaveProperty("span_ids");
  });

  it("should create a dataset with splits and span IDs", async () => {
    const mockResponse = {
      dataset_id: "dataset-123",
      version_id: "version-456",
    };

    mockPost.mockResolvedValue({
      data: { data: mockResponse },
      error: null,
    });

    await createDataset({
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

    expect(mockPost).toHaveBeenCalledWith("/v1/datasets/upload", {
      params: {
        query: {
          sync: true,
        },
      },
      body: {
        name: "test-dataset",
        description: "A dataset with splits and span links",
        action: "create",
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

  it("should handle metadata in examples", async () => {
    const mockResponse = {
      dataset_id: "dataset-123",
      version_id: "version-456",
    };

    mockPost.mockResolvedValue({
      data: { data: mockResponse },
      error: null,
    });

    await createDataset({
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

    expect(mockPost).toHaveBeenCalledWith("/v1/datasets/upload", {
      params: {
        query: {
          sync: true,
        },
      },
      body: {
        name: "test-dataset",
        description: "A dataset with metadata",
        action: "create",
        inputs: [{ question: "What is AI?" }],
        outputs: [{ answer: "Artificial Intelligence" }],
        metadata: [{ source: "wikipedia", difficulty: "easy" }],
        splits: [null],
        span_ids: ["span-abc123"],
      },
    });
  });

  it("should throw error when response data is missing", async () => {
    mockPost.mockResolvedValue({
      data: null,
      error: null,
    });

    await expect(
      createDataset({
        name: "test-dataset",
        description: "A test dataset",
        examples: [{ input: { question: "What is AI?" } }],
      })
    ).rejects.toThrow("Failed to create dataset");
  });

  it("should handle null output in examples", async () => {
    const mockResponse = {
      dataset_id: "dataset-123",
      version_id: "version-456",
    };

    mockPost.mockResolvedValue({
      data: { data: mockResponse },
      error: null,
    });

    await createDataset({
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

    expect(mockPost).toHaveBeenCalledWith("/v1/datasets/upload", {
      params: {
        query: {
          sync: true,
        },
      },
      body: {
        name: "test-dataset",
        description: "A dataset with null outputs",
        action: "create",
        inputs: [{ question: "What is AI?" }],
        outputs: [{}], // null is converted to empty object
        metadata: [{}],
        splits: [null],
        span_ids: ["span-abc123"],
      },
    });
  });
});

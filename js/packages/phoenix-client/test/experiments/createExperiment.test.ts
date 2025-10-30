import { describe, it, expect, vi, beforeEach } from "vitest";
import { createExperiment } from "../../src/experiments/createExperiment";

// Mock the fetch module
const mockPost = vi.fn();
vi.mock("openapi-fetch", () => ({
  default: () => ({
    POST: mockPost,
    use: () => {},
  }),
}));

describe("createExperiment", () => {
  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();
  });

  it("should create an experiment with minimal parameters", async () => {
    const mockResponse = {
      id: "exp-123",
      dataset_id: "dataset-456",
      dataset_version_id: "version-789",
      repetitions: 1,
      metadata: {},
      project_name: null,
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
      example_count: 10,
      successful_run_count: 0,
      failed_run_count: 0,
      missing_run_count: 10,
    };

    mockPost.mockResolvedValue({
      data: { data: mockResponse },
      error: null,
    });

    const result = await createExperiment({
      datasetId: "dataset-456",
    });

    expect(mockPost).toHaveBeenCalledWith(
      "/v1/datasets/{dataset_id}/experiments",
      {
        params: {
          path: {
            dataset_id: "dataset-456",
          },
        },
        body: {
          name: undefined,
          description: undefined,
          metadata: {},
          repetitions: 1,
        },
      }
    );

    expect(result).toEqual({
      id: "exp-123",
      datasetId: "dataset-456",
      datasetVersionId: "version-789",
      datasetSplits: [],
      repetitions: 1,
      metadata: {},
      projectName: null,
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
      exampleCount: 10,
      successfulRunCount: 0,
      failedRunCount: 0,
      missingRunCount: 10,
    });
  });

  it("should create an experiment with all optional parameters", async () => {
    const mockResponse = {
      id: "exp-123",
      dataset_id: "dataset-456",
      dataset_version_id: "version-specific",
      repetitions: 3,
      metadata: { model: "gpt-4", temperature: 0.7 },
      project_name: "test-project",
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
      example_count: 5,
      successful_run_count: 0,
      failed_run_count: 0,
      missing_run_count: 15,
    };

    mockPost.mockResolvedValue({
      data: { data: mockResponse },
      error: null,
    });

    const result = await createExperiment({
      datasetId: "dataset-456",
      datasetVersionId: "version-specific",
      experimentName: "My Experiment",
      experimentDescription: "Test experiment description",
      experimentMetadata: { model: "gpt-4", temperature: 0.7 },
      splits: ["train", "test"],
      repetitions: 3,
    });

    expect(mockPost).toHaveBeenCalledWith(
      "/v1/datasets/{dataset_id}/experiments",
      {
        params: {
          path: {
            dataset_id: "dataset-456",
          },
        },
        body: {
          name: "My Experiment",
          description: "Test experiment description",
          metadata: { model: "gpt-4", temperature: 0.7 },
          repetitions: 3,
          version_id: "version-specific",
          splits: ["train", "test"],
        },
      }
    );

    expect(result).toEqual({
      id: "exp-123",
      datasetId: "dataset-456",
      datasetVersionId: "version-specific",
      datasetSplits: ["train", "test"],
      repetitions: 3,
      metadata: { model: "gpt-4", temperature: 0.7 },
      projectName: "test-project",
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
      exampleCount: 5,
      successfulRunCount: 0,
      failedRunCount: 0,
      missingRunCount: 15,
    });
  });

  it("should create an experiment with splits only", async () => {
    const mockResponse = {
      id: "exp-123",
      dataset_id: "dataset-456",
      dataset_version_id: "version-789",
      repetitions: 1,
      metadata: {},
      project_name: null,
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
      example_count: 3,
      successful_run_count: 0,
      failed_run_count: 0,
      missing_run_count: 3,
    };

    mockPost.mockResolvedValue({
      data: { data: mockResponse },
      error: null,
    });

    const result = await createExperiment({
      datasetId: "dataset-456",
      splits: ["train"],
    });

    expect(mockPost).toHaveBeenCalledWith(
      "/v1/datasets/{dataset_id}/experiments",
      {
        params: {
          path: {
            dataset_id: "dataset-456",
          },
        },
        body: {
          name: undefined,
          description: undefined,
          metadata: {},
          repetitions: 1,
          splits: ["train"],
        },
      }
    );

    expect(result.datasetSplits).toEqual(["train"]);
    expect(result.exampleCount).toBe(3);
  });

  it("should create an experiment with custom repetitions", async () => {
    const mockResponse = {
      id: "exp-123",
      dataset_id: "dataset-456",
      dataset_version_id: "version-789",
      repetitions: 5,
      metadata: {},
      project_name: null,
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
      example_count: 10,
      successful_run_count: 0,
      failed_run_count: 0,
      missing_run_count: 50,
    };

    mockPost.mockResolvedValue({
      data: { data: mockResponse },
      error: null,
    });

    const result = await createExperiment({
      datasetId: "dataset-456",
      repetitions: 5,
    });

    expect(result.repetitions).toBe(5);
    expect(result.missingRunCount).toBe(50);
  });

  it("should handle null metadata in response", async () => {
    const mockResponse = {
      id: "exp-123",
      dataset_id: "dataset-456",
      dataset_version_id: "version-789",
      repetitions: 1,
      metadata: null,
      project_name: null,
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
      example_count: 10,
      successful_run_count: 0,
      failed_run_count: 0,
      missing_run_count: 10,
    };

    mockPost.mockResolvedValue({
      data: { data: mockResponse },
      error: null,
    });

    const result = await createExperiment({
      datasetId: "dataset-456",
    });

    expect(result.metadata).toEqual({});
  });

  it("should throw error when dataset is not found", async () => {
    mockPost.mockResolvedValue({
      data: null,
      error: {
        status: 404,
        message: "Dataset not found",
      },
    });

    await expect(
      createExperiment({
        datasetId: "nonexistent-dataset",
      })
    ).rejects.toThrow("Failed to create experiment");
  });

  it("should throw error when response data is missing", async () => {
    mockPost.mockResolvedValue({
      data: null,
      error: null,
    });

    await expect(
      createExperiment({
        datasetId: "dataset-456",
      })
    ).rejects.toThrow("Failed to create experiment");
  });

  it("should throw error for validation errors", async () => {
    mockPost.mockResolvedValue({
      data: null,
      error: {
        status: 422,
        message: "Validation Error",
      },
    });

    await expect(
      createExperiment({
        datasetId: "dataset-456",
        repetitions: 0, // Invalid repetitions
      })
    ).rejects.toThrow("Failed to create experiment");
  });

  it("should handle readonly splits array", async () => {
    const mockResponse = {
      id: "exp-123",
      dataset_id: "dataset-456",
      dataset_version_id: "version-789",
      repetitions: 1,
      metadata: {},
      project_name: null,
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
      example_count: 5,
      successful_run_count: 0,
      failed_run_count: 0,
      missing_run_count: 5,
    };

    mockPost.mockResolvedValue({
      data: { data: mockResponse },
      error: null,
    });

    const splits: readonly string[] = ["train", "validation"] as const;

    const result = await createExperiment({
      datasetId: "dataset-456",
      splits,
    });

    expect(mockPost).toHaveBeenCalledWith(
      "/v1/datasets/{dataset_id}/experiments",
      {
        params: {
          path: {
            dataset_id: "dataset-456",
          },
        },
        body: {
          name: undefined,
          description: undefined,
          metadata: {},
          repetitions: 1,
          splits: ["train", "validation"],
        },
      }
    );

    expect(result.datasetSplits).toEqual(["train", "validation"]);
  });
});

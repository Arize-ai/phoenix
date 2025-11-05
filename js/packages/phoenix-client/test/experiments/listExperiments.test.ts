import { components } from "../../src/__generated__/api/v1";
import { listExperiments } from "../../src/experiments/listExperiments";

import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGet = vi.fn();

// Mock the fetch module
vi.mock("openapi-fetch", () => ({
  default: () => ({
    GET: mockGet,
    use: () => {},
  }),
}));

const mockExperiments: components["schemas"]["ListExperimentsResponseBody"]["data"] =
  [
    {
      id: "exp-1",
      dataset_id: "dataset-123",
      dataset_version_id: "v1",
      repetitions: 1,
      metadata: { model: "gpt-4" },
      project_name: "test-project",
      created_at: "2025-01-01T00:00:00.000Z",
      updated_at: "2025-01-01T00:00:00.000Z",
      example_count: 10,
      successful_run_count: 8,
      failed_run_count: 2,
      missing_run_count: 0,
    },
    {
      id: "exp-2",
      dataset_id: "dataset-123",
      dataset_version_id: "v2",
      repetitions: 2,
      metadata: {},
      project_name: null,
      created_at: "2025-01-02T00:00:00.000Z",
      updated_at: "2025-01-02T00:00:00.000Z",
      example_count: 5,
      successful_run_count: 5,
      failed_run_count: 0,
      missing_run_count: 0,
    },
  ];

describe("listExperiments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockReset();
  });

  it("should list experiments without pagination if no next_cursor", async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        data: mockExperiments,
      },
    });

    const experiments = await listExperiments({ datasetId: "dataset-123" });

    expect(mockGet).toHaveBeenCalledOnce();
    expect(mockGet).toHaveBeenCalledWith(
      "/v1/datasets/{dataset_id}/experiments",
      {
        params: {
          path: {
            dataset_id: "dataset-123",
          },
          query: {
            cursor: null,
            limit: 50,
          },
        },
      }
    );

    expect(experiments).toHaveLength(2);
    expect(experiments[0]).toMatchObject({
      id: "exp-1",
      datasetId: "dataset-123",
      datasetVersionId: "v1",
      repetitions: 1,
      projectName: "test-project",
      exampleCount: 10,
      successfulRunCount: 8,
      failedRunCount: 2,
      missingRunCount: 0,
    });
    expect(experiments[1]).toMatchObject({
      id: "exp-2",
      datasetId: "dataset-123",
      projectName: null,
    });
  });

  it("should paginate through records and fetch all experiments", async () => {
    mockGet
      .mockResolvedValueOnce({
        data: {
          data: [mockExperiments[0]],
          next_cursor: "cursor1",
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: [mockExperiments[1]],
          next_cursor: "cursor2",
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: mockExperiments,
          next_cursor: null,
        },
      });

    const experiments = await listExperiments({ datasetId: "dataset-123" });

    expect(mockGet).toHaveBeenCalledTimes(3);
    expect(experiments).toHaveLength(4); // 1 + 1 + 2 = 4 experiments

    // Verify cursor was passed through
    expect(mockGet).toHaveBeenNthCalledWith(
      2,
      "/v1/datasets/{dataset_id}/experiments",
      {
        params: {
          path: {
            dataset_id: "dataset-123",
          },
          query: {
            cursor: "cursor1",
            limit: 50,
          },
        },
      }
    );
  });

  it("should throw error if API returns no data", async () => {
    mockGet.mockResolvedValueOnce({
      data: undefined,
    });

    await expect(listExperiments({ datasetId: "dataset-123" })).rejects.toThrow(
      "Failed to list experiments"
    );
  });

  it("should handle empty metadata", async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        data: [
          {
            ...mockExperiments[0],
            metadata: null,
          },
        ],
      },
    });

    const experiments = await listExperiments({ datasetId: "dataset-123" });

    expect(experiments[0].metadata).toEqual({});
  });
});

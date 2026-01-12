import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchExperiments } from "../../src/snapshot/experiments.js";
import type { ExecutionMode } from "../../src/modes/types.js";

// Mock the Phoenix client module
vi.mock("@arizeai/phoenix-client", () => ({
  createClient: vi.fn(),
}));

// Mock the client module
vi.mock("../../src/snapshot/client.js", async (importOriginal) => {
  const actual = (await importOriginal()) as any;
  return {
    ...actual,
    withErrorHandling: actual.withErrorHandling,
    extractData: actual.extractData,
    PhoenixClientError: actual.PhoenixClientError,
  };
});

describe("fetchExperiments", () => {
  let mockClient: any;
  let mockMode: ExecutionMode;
  const writtenFiles: Map<string, string> = new Map();

  beforeEach(() => {
    writtenFiles.clear();

    // Mock execution mode
    mockMode = {
      writeFile: vi.fn(async (path, content) => {
        writtenFiles.set(path, content);
      }),
      exec: vi.fn(),
      getBashTool: vi.fn().mockResolvedValue({}),
      cleanup: vi.fn(),
    };

    // Mock Phoenix client
    mockClient = {
      GET: vi.fn(),
    };
  });

  it("should fetch experiments and their runs", async () => {
    // Mock dataset list response
    mockClient.GET.mockResolvedValueOnce({
      data: {
        data: [
          {
            id: "dataset-1",
            name: "test-dataset-1",
          },
          {
            id: "dataset-2",
            name: "production-data",
          },
        ],
        next_cursor: null,
      },
    });

    // Mock experiments for dataset-1
    mockClient.GET.mockResolvedValueOnce({
      data: {
        data: [
          {
            id: "exp-1",
            dataset_id: "dataset-1",
            dataset_version_id: "version-1",
            repetitions: 3,
            metadata: { model: "gpt-4" },
            project_name: "eval-project",
            created_at: "2025-01-01T00:00:00Z",
            updated_at: "2025-01-02T00:00:00Z",
            example_count: 10,
            successful_run_count: 8,
            failed_run_count: 1,
            missing_run_count: 1,
          },
        ],
        next_cursor: null,
      },
    });

    // Mock experiments for dataset-2 (empty)
    mockClient.GET.mockResolvedValueOnce({
      data: {
        data: [],
        next_cursor: null,
      },
    });

    // Mock runs for exp-1
    mockClient.GET.mockResolvedValueOnce({
      data: {
        data: [
          {
            id: "run-1",
            experiment_id: "exp-1",
            dataset_example_id: "example-1",
            start_time: "2025-01-01T00:00:00Z",
            end_time: "2025-01-01T00:01:00Z",
            output: { result: "answer 1" },
            error: null,
            trace_id: "trace-1",
            repetition_number: 1,
          },
          {
            id: "run-2",
            experiment_id: "exp-1",
            dataset_example_id: "example-1",
            start_time: "2025-01-01T00:02:00Z",
            end_time: "2025-01-01T00:03:00Z",
            output: { result: "answer 2" },
            error: null,
            trace_id: "trace-2",
            repetition_number: 2,
          },
        ],
        next_cursor: null,
      },
    });

    await fetchExperiments(mockClient, mockMode);

    // Check that experiments index was written
    expect(mockMode.writeFile).toHaveBeenCalledWith(
      "/phoenix/experiments/index.jsonl",
      expect.any(String)
    );

    const experimentsIndexContent = writtenFiles.get(
      "/phoenix/experiments/index.jsonl"
    );
    expect(experimentsIndexContent).toBeDefined();
    const experiments = experimentsIndexContent!
      .split("\n")
      .filter((line) => line)
      .map((line) => JSON.parse(line));
    expect(experiments).toHaveLength(1);
    expect(experiments[0].id).toBe("exp-1");
    expect(experiments[0].datasetName).toBe("test-dataset-1");

    // Check metadata file
    expect(mockMode.writeFile).toHaveBeenCalledWith(
      "/phoenix/experiments/exp-1/metadata.json",
      expect.any(String)
    );
    const metadata = JSON.parse(
      writtenFiles.get("/phoenix/experiments/exp-1/metadata.json")!
    );
    expect(metadata.id).toBe("exp-1");
    expect(metadata.dataset_name).toBe("test-dataset-1");
    expect(metadata.project_name).toBe("eval-project");
    expect(metadata.snapshot_timestamp).toBeDefined();

    // Check runs file
    expect(mockMode.writeFile).toHaveBeenCalledWith(
      "/phoenix/experiments/exp-1/runs.jsonl",
      expect.any(String)
    );
    const runs = writtenFiles
      .get("/phoenix/experiments/exp-1/runs.jsonl")!
      .split("\n")
      .filter((line) => line)
      .map((line) => JSON.parse(line));
    expect(runs).toHaveLength(2);
    expect(runs[0].id).toBe("run-1");
    expect(runs[1].id).toBe("run-2");

    // Check summary file
    expect(mockMode.writeFile).toHaveBeenCalledWith(
      "/phoenix/experiments/exp-1/summary.json",
      expect.any(String)
    );
    const summary = JSON.parse(
      writtenFiles.get("/phoenix/experiments/exp-1/summary.json")!
    );
    expect(summary.experiment_id).toBe("exp-1");
    expect(summary.total_runs).toBe(2);
    expect(summary.successful_runs).toBe(8);

    // Verify API calls
    expect(mockClient.GET).toHaveBeenCalledTimes(4);
    expect(mockClient.GET).toHaveBeenCalledWith("/v1/datasets", {
      params: { query: { limit: 1000 } },
    });
    expect(mockClient.GET).toHaveBeenCalledWith(
      "/v1/datasets/{dataset_id}/experiments",
      {
        params: {
          path: { dataset_id: "dataset-1" },
          query: { cursor: null, limit: 50 },
        },
      }
    );
  });

  it("should handle empty experiments list", async () => {
    mockClient.GET.mockResolvedValueOnce({
      data: {
        data: [],
        next_cursor: null,
      },
    });

    await fetchExperiments(mockClient, mockMode);

    expect(mockMode.writeFile).toHaveBeenCalledWith(
      "/phoenix/experiments/index.jsonl",
      ""
    );
    expect(mockMode.writeFile).toHaveBeenCalledTimes(1);
  });

  it("should handle pagination when fetching experiments", async () => {
    // Mock datasets
    mockClient.GET.mockResolvedValueOnce({
      data: {
        data: [{ id: "dataset-1", name: "test-dataset" }],
        next_cursor: null,
      },
    });

    // First page of experiments
    mockClient.GET.mockResolvedValueOnce({
      data: {
        data: [
          {
            id: "exp-1",
            dataset_id: "dataset-1",
            dataset_version_id: "v1",
            repetitions: 1,
            metadata: {},
            project_name: null,
            created_at: "2025-01-01T00:00:00Z",
            updated_at: "2025-01-01T00:00:00Z",
            example_count: 5,
            successful_run_count: 5,
            failed_run_count: 0,
            missing_run_count: 0,
          },
        ],
        next_cursor: "cursor-1",
      },
    });

    // Second page of experiments
    mockClient.GET.mockResolvedValueOnce({
      data: {
        data: [
          {
            id: "exp-2",
            dataset_id: "dataset-1",
            dataset_version_id: "v1",
            repetitions: 1,
            metadata: {},
            project_name: null,
            created_at: "2025-01-01T00:00:00Z",
            updated_at: "2025-01-01T00:00:00Z",
            example_count: 3,
            successful_run_count: 3,
            failed_run_count: 0,
            missing_run_count: 0,
          },
        ],
        next_cursor: null,
      },
    });

    // Mock empty runs for both experiments
    mockClient.GET.mockResolvedValueOnce({
      data: { data: [], next_cursor: null },
    });
    mockClient.GET.mockResolvedValueOnce({
      data: { data: [], next_cursor: null },
    });

    await fetchExperiments(mockClient, mockMode);

    const experimentsContent = writtenFiles.get(
      "/phoenix/experiments/index.jsonl"
    );
    const experiments = experimentsContent!
      .split("\n")
      .filter((line) => line)
      .map((line) => JSON.parse(line));
    expect(experiments).toHaveLength(2);
  });

  it("should skip runs when includeRuns is false", async () => {
    // Mock datasets
    mockClient.GET.mockResolvedValueOnce({
      data: {
        data: [{ id: "dataset-1", name: "test-dataset" }],
        next_cursor: null,
      },
    });

    // Mock experiments
    mockClient.GET.mockResolvedValueOnce({
      data: {
        data: [
          {
            id: "exp-1",
            dataset_id: "dataset-1",
            dataset_version_id: "v1",
            repetitions: 1,
            metadata: {},
            project_name: null,
            created_at: "2025-01-01T00:00:00Z",
            updated_at: "2025-01-01T00:00:00Z",
            example_count: 5,
            successful_run_count: 5,
            failed_run_count: 0,
            missing_run_count: 0,
          },
        ],
        next_cursor: null,
      },
    });

    await fetchExperiments(mockClient, mockMode, { includeRuns: false });

    // Should not fetch runs
    expect(mockClient.GET).toHaveBeenCalledTimes(2); // Only datasets and experiments

    // Should only write the index
    expect(mockMode.writeFile).toHaveBeenCalledTimes(1);
    expect(mockMode.writeFile).toHaveBeenCalledWith(
      "/phoenix/experiments/index.jsonl",
      expect.any(String)
    );
  });

  it("should respect the limit option", async () => {
    // Mock datasets
    mockClient.GET.mockResolvedValueOnce({
      data: {
        data: [
          { id: "dataset-1", name: "dataset-1" },
          { id: "dataset-2", name: "dataset-2" },
        ],
        next_cursor: null,
      },
    });

    // Mock experiments for dataset-1
    mockClient.GET.mockResolvedValueOnce({
      data: {
        data: Array.from({ length: 3 }, (_, i) => ({
          id: `exp-${i + 1}`,
          dataset_id: "dataset-1",
          dataset_version_id: "v1",
          repetitions: 1,
          metadata: {},
          project_name: null,
          created_at: "2025-01-01T00:00:00Z",
          updated_at: "2025-01-01T00:00:00Z",
          example_count: 1,
          successful_run_count: 1,
          failed_run_count: 0,
          missing_run_count: 0,
        })),
        next_cursor: null,
      },
    });

    // Mock runs for experiments
    for (let i = 1; i <= 2; i++) {
      mockClient.GET.mockResolvedValueOnce({
        data: { data: [], next_cursor: null },
      });
    }

    await fetchExperiments(mockClient, mockMode, { limit: 2 });

    const experimentsContent = writtenFiles.get(
      "/phoenix/experiments/index.jsonl"
    );
    const experiments = experimentsContent!
      .split("\n")
      .filter((line) => line)
      .map((line) => JSON.parse(line));
    expect(experiments).toHaveLength(2);

    // Should not fetch experiments from second dataset
    expect(mockClient.GET).not.toHaveBeenCalledWith(
      "/v1/datasets/{dataset_id}/experiments",
      expect.objectContaining({
        params: expect.objectContaining({
          path: { dataset_id: "dataset-2" },
        }),
      })
    );
  });

  it("should handle errors when fetching experiments for a dataset", async () => {
    // Mock datasets
    mockClient.GET.mockResolvedValueOnce({
      data: {
        data: [
          { id: "dataset-1", name: "dataset-1" },
          { id: "dataset-2", name: "dataset-2" },
        ],
        next_cursor: null,
      },
    });

    // Mock error for dataset-1
    mockClient.GET.mockRejectedValueOnce(
      new Error("localhost:6006: 500 Server Error")
    );

    // Mock experiments for dataset-2
    mockClient.GET.mockResolvedValueOnce({
      data: {
        data: [
          {
            id: "exp-1",
            dataset_id: "dataset-2",
            dataset_version_id: "v1",
            repetitions: 1,
            metadata: {},
            project_name: null,
            created_at: "2025-01-01T00:00:00Z",
            updated_at: "2025-01-01T00:00:00Z",
            example_count: 1,
            successful_run_count: 1,
            failed_run_count: 0,
            missing_run_count: 0,
          },
        ],
        next_cursor: null,
      },
    });

    // Mock runs
    mockClient.GET.mockResolvedValueOnce({
      data: { data: [], next_cursor: null },
    });

    // Should not throw, just log and continue
    await fetchExperiments(mockClient, mockMode);

    const experimentsContent = writtenFiles.get(
      "/phoenix/experiments/index.jsonl"
    );
    const experiments = experimentsContent!
      .split("\n")
      .filter((line) => line)
      .map((line) => JSON.parse(line));
    expect(experiments).toHaveLength(1);
    expect(experiments[0].id).toBe("exp-1");
  });

  it("should handle errors when fetching runs", async () => {
    // Mock datasets and experiments
    mockClient.GET.mockResolvedValueOnce({
      data: {
        data: [{ id: "dataset-1", name: "test-dataset" }],
        next_cursor: null,
      },
    });

    mockClient.GET.mockResolvedValueOnce({
      data: {
        data: [
          {
            id: "exp-1",
            dataset_id: "dataset-1",
            dataset_version_id: "v1",
            repetitions: 1,
            metadata: {},
            project_name: null,
            created_at: "2025-01-01T00:00:00Z",
            updated_at: "2025-01-01T00:00:00Z",
            example_count: 1,
            successful_run_count: 1,
            failed_run_count: 0,
            missing_run_count: 0,
          },
        ],
        next_cursor: null,
      },
    });

    // Mock error when fetching runs
    mockClient.GET.mockRejectedValueOnce(
      new Error("localhost:6006: 404 Not Found")
    );

    // Should not throw, just create metadata with error
    await fetchExperiments(mockClient, mockMode);

    // Check that metadata was created with error
    const metadata = JSON.parse(
      writtenFiles.get("/phoenix/experiments/exp-1/metadata.json")!
    );
    expect(metadata.error).toBe("Failed to fetch runs");
    expect(metadata.id).toBe("exp-1");

    // Should not have created runs.jsonl or summary.json
    expect(writtenFiles.has("/phoenix/experiments/exp-1/runs.jsonl")).toBe(
      false
    );
    expect(writtenFiles.has("/phoenix/experiments/exp-1/summary.json")).toBe(
      false
    );
  });

  it("should handle pagination when fetching runs", async () => {
    // Mock datasets and experiments
    mockClient.GET.mockResolvedValueOnce({
      data: {
        data: [{ id: "dataset-1", name: "test-dataset" }],
        next_cursor: null,
      },
    });

    mockClient.GET.mockResolvedValueOnce({
      data: {
        data: [
          {
            id: "exp-1",
            dataset_id: "dataset-1",
            dataset_version_id: "v1",
            repetitions: 1,
            metadata: {},
            project_name: null,
            created_at: "2025-01-01T00:00:00Z",
            updated_at: "2025-01-01T00:00:00Z",
            example_count: 150,
            successful_run_count: 150,
            failed_run_count: 0,
            missing_run_count: 0,
          },
        ],
        next_cursor: null,
      },
    });

    // First page of runs
    mockClient.GET.mockResolvedValueOnce({
      data: {
        data: Array.from({ length: 100 }, (_, i) => ({
          id: `run-${i + 1}`,
          experiment_id: "exp-1",
          dataset_example_id: `example-${i + 1}`,
          start_time: "2025-01-01T00:00:00Z",
          end_time: "2025-01-01T00:01:00Z",
          output: { result: `answer ${i + 1}` },
          error: null,
          trace_id: `trace-${i + 1}`,
        })),
        next_cursor: "runs-cursor",
      },
    });

    // Second page of runs
    mockClient.GET.mockResolvedValueOnce({
      data: {
        data: Array.from({ length: 50 }, (_, i) => ({
          id: `run-${i + 101}`,
          experiment_id: "exp-1",
          dataset_example_id: `example-${i + 101}`,
          start_time: "2025-01-01T00:00:00Z",
          end_time: "2025-01-01T00:01:00Z",
          output: { result: `answer ${i + 101}` },
          error: null,
          trace_id: `trace-${i + 101}`,
        })),
        next_cursor: null,
      },
    });

    await fetchExperiments(mockClient, mockMode);

    const runsContent = writtenFiles.get(
      "/phoenix/experiments/exp-1/runs.jsonl"
    );
    const runs = runsContent!
      .split("\n")
      .filter((line) => line)
      .map((line) => JSON.parse(line));
    expect(runs).toHaveLength(150);

    // Verify pagination calls for runs
    expect(mockClient.GET).toHaveBeenCalledWith(
      "/v1/experiments/{experiment_id}/runs",
      {
        params: {
          path: { experiment_id: "exp-1" },
          query: { cursor: null, limit: 100 },
        },
      }
    );
    expect(mockClient.GET).toHaveBeenCalledWith(
      "/v1/experiments/{experiment_id}/runs",
      {
        params: {
          path: { experiment_id: "exp-1" },
          query: { cursor: "runs-cursor", limit: 100 },
        },
      }
    );
  });
});

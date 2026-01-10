import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchDatasets } from "../../src/snapshot/datasets.js";
import type { ExecutionMode } from "../../src/modes/types.js";
import { PhoenixClientError } from "../../src/snapshot/client.js";

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

describe("fetchDatasets", () => {
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

  it("should fetch datasets and their examples", async () => {
    // Mock dataset list response
    mockClient.GET.mockResolvedValueOnce({
      data: {
        data: [
          {
            id: "dataset-1",
            name: "test-dataset-1",
            description: "First test dataset",
            metadata: { tags: ["test", "v1"] },
            created_at: "2025-01-01T00:00:00Z",
            updated_at: "2025-01-02T00:00:00Z",
          },
          {
            id: "dataset-2",
            name: "production-data",
            description: null,
            metadata: {},
            created_at: "2025-01-03T00:00:00Z",
            updated_at: "2025-01-03T00:00:00Z",
          },
        ],
        next_cursor: null,
      },
    });

    // Mock examples for dataset-1
    mockClient.GET.mockResolvedValueOnce({
      data: {
        data: {
          dataset_id: "dataset-1",
          version_id: "version-1",
          filtered_splits: undefined,
          examples: [
            {
              id: "example-1",
              input: { question: "What is AI?" },
              output: { answer: "Artificial Intelligence" },
              metadata: { score: 0.9 },
              updated_at: "2025-01-01T00:00:00Z",
            },
            {
              id: "example-2",
              input: { question: "How does ML work?" },
              output: { answer: "Machine Learning uses algorithms" },
              metadata: { score: 0.8 },
              updated_at: "2025-01-01T00:00:00Z",
            },
          ],
        },
      },
    });

    // Mock examples for dataset-2
    mockClient.GET.mockResolvedValueOnce({
      data: {
        data: {
          dataset_id: "dataset-2",
          version_id: "version-2",
          filtered_splits: ["train", "test"],
          examples: [],
        },
      },
    });

    await fetchDatasets(mockClient, mockMode);

    // Check that datasets index was written
    expect(mockMode.writeFile).toHaveBeenCalledWith(
      "/phoenix/datasets/index.jsonl",
      expect.any(String)
    );

    const datasetsIndexContent = writtenFiles.get(
      "/phoenix/datasets/index.jsonl"
    );
    expect(datasetsIndexContent).toBeDefined();
    const datasets = datasetsIndexContent!
      .split("\n")
      .filter((line) => line)
      .map((line) => JSON.parse(line));
    expect(datasets).toHaveLength(2);
    expect(datasets[0].name).toBe("test-dataset-1");
    expect(datasets[1].name).toBe("production-data");

    // Check metadata files
    expect(mockMode.writeFile).toHaveBeenCalledWith(
      "/phoenix/datasets/test-dataset-1/metadata.json",
      expect.any(String)
    );
    const metadata1 = JSON.parse(
      writtenFiles.get("/phoenix/datasets/test-dataset-1/metadata.json")!
    );
    expect(metadata1.id).toBe("dataset-1");
    expect(metadata1.description).toBe("First test dataset");
    expect(metadata1.snapshot_timestamp).toBeDefined();

    // Check examples files
    expect(mockMode.writeFile).toHaveBeenCalledWith(
      "/phoenix/datasets/test-dataset-1/examples.jsonl",
      expect.any(String)
    );
    const examples1 = writtenFiles
      .get("/phoenix/datasets/test-dataset-1/examples.jsonl")!
      .split("\n")
      .filter((line) => line)
      .map((line) => JSON.parse(line));
    expect(examples1).toHaveLength(2);
    expect(examples1[0].input.question).toBe("What is AI?");

    // Check info files
    expect(mockMode.writeFile).toHaveBeenCalledWith(
      "/phoenix/datasets/test-dataset-1/info.json",
      expect.any(String)
    );
    const info1 = JSON.parse(
      writtenFiles.get("/phoenix/datasets/test-dataset-1/info.json")!
    );
    expect(info1.example_count).toBe(2);
    expect(info1.version_id).toBe("version-1");

    // Check empty dataset
    expect(mockMode.writeFile).toHaveBeenCalledWith(
      "/phoenix/datasets/production-data/examples.jsonl",
      ""
    );
    const info2 = JSON.parse(
      writtenFiles.get("/phoenix/datasets/production-data/info.json")!
    );
    expect(info2.example_count).toBe(0);
    expect(info2.filtered_splits).toEqual(["train", "test"]);

    // Verify API calls
    expect(mockClient.GET).toHaveBeenCalledTimes(3);
    expect(mockClient.GET).toHaveBeenCalledWith("/v1/datasets", {
      params: { query: { limit: 100 } },
    });
    expect(mockClient.GET).toHaveBeenCalledWith("/v1/datasets/{id}/examples", {
      params: { path: { id: "dataset-1" } },
    });
    expect(mockClient.GET).toHaveBeenCalledWith("/v1/datasets/{id}/examples", {
      params: { path: { id: "dataset-2" } },
    });
  });

  it("should handle empty datasets list", async () => {
    mockClient.GET.mockResolvedValueOnce({
      data: {
        data: [],
        next_cursor: null,
      },
    });

    await fetchDatasets(mockClient, mockMode);

    expect(mockMode.writeFile).toHaveBeenCalledWith(
      "/phoenix/datasets/index.jsonl",
      ""
    );
    expect(mockMode.writeFile).toHaveBeenCalledTimes(1);
  });

  it("should handle pagination when fetching datasets", async () => {
    // First page
    mockClient.GET.mockResolvedValueOnce({
      data: {
        data: [
          {
            id: "dataset-1",
            name: "dataset-1",
            description: null,
            metadata: {},
            created_at: "2025-01-01T00:00:00Z",
            updated_at: "2025-01-01T00:00:00Z",
          },
        ],
        next_cursor: "cursor-1",
      },
    });

    // Second page
    mockClient.GET.mockResolvedValueOnce({
      data: {
        data: [
          {
            id: "dataset-2",
            name: "dataset-2",
            description: null,
            metadata: {},
            created_at: "2025-01-01T00:00:00Z",
            updated_at: "2025-01-01T00:00:00Z",
          },
        ],
        next_cursor: null,
      },
    });

    // Mock examples for both datasets
    mockClient.GET.mockResolvedValueOnce({
      data: {
        data: { dataset_id: "dataset-1", version_id: "v1", examples: [] },
      },
    });
    mockClient.GET.mockResolvedValueOnce({
      data: {
        data: { dataset_id: "dataset-2", version_id: "v2", examples: [] },
      },
    });

    await fetchDatasets(mockClient, mockMode);

    const datasetsContent = writtenFiles.get("/phoenix/datasets/index.jsonl");
    const datasets = datasetsContent!
      .split("\n")
      .filter((line) => line)
      .map((line) => JSON.parse(line));
    expect(datasets).toHaveLength(2);

    // Verify pagination calls - the second call should have limit 99 since we already have 1 dataset
    expect(mockClient.GET).toHaveBeenCalledWith("/v1/datasets", {
      params: { query: { limit: 100 } },
    });
    expect(mockClient.GET).toHaveBeenCalledWith("/v1/datasets", {
      params: { query: { limit: 99, cursor: "cursor-1" } },
    });
  });

  it("should respect the limit option", async () => {
    // Mock response with many datasets
    mockClient.GET.mockResolvedValueOnce({
      data: {
        data: Array.from({ length: 3 }, (_, i) => ({
          id: `dataset-${i + 1}`,
          name: `dataset-${i + 1}`,
          description: null,
          metadata: {},
          created_at: "2025-01-01T00:00:00Z",
          updated_at: "2025-01-01T00:00:00Z",
        })),
        next_cursor: "more-data",
      },
    });

    // Mock examples for each dataset
    for (let i = 1; i <= 3; i++) {
      mockClient.GET.mockResolvedValueOnce({
        data: {
          data: {
            dataset_id: `dataset-${i}`,
            version_id: `v${i}`,
            examples: [],
          },
        },
      });
    }

    await fetchDatasets(mockClient, mockMode, { limit: 3 });

    const datasetsContent = writtenFiles.get("/phoenix/datasets/index.jsonl");
    const datasets = datasetsContent!
      .split("\n")
      .filter((line) => line)
      .map((line) => JSON.parse(line));
    expect(datasets).toHaveLength(3);

    // Should not fetch more pages even if cursor exists
    expect(mockClient.GET).toHaveBeenCalledWith("/v1/datasets", {
      params: { query: { limit: 3 } },
    });
    expect(mockClient.GET).not.toHaveBeenCalledWith("/v1/datasets", {
      params: { query: expect.objectContaining({ cursor: "more-data" }) },
    });
  });

  it("should handle dataset names with special characters", async () => {
    mockClient.GET.mockResolvedValueOnce({
      data: {
        data: [
          {
            id: "dataset-1",
            name: "test dataset/with spaces & chars",
            description: "Special dataset",
            metadata: {},
            created_at: "2025-01-01T00:00:00Z",
            updated_at: "2025-01-01T00:00:00Z",
          },
        ],
        next_cursor: null,
      },
    });

    mockClient.GET.mockResolvedValueOnce({
      data: {
        data: { dataset_id: "dataset-1", version_id: "v1", examples: [] },
      },
    });

    await fetchDatasets(mockClient, mockMode);

    expect(mockMode.writeFile).toHaveBeenCalledWith(
      "/phoenix/datasets/test dataset/with spaces & chars/metadata.json",
      expect.any(String)
    );
    expect(mockMode.writeFile).toHaveBeenCalledWith(
      "/phoenix/datasets/test dataset/with spaces & chars/examples.jsonl",
      ""
    );
  });

  it("should handle API errors appropriately", async () => {
    mockClient.GET.mockRejectedValue(
      new Error("localhost:6006: 401 Unauthorized")
    );

    await expect(fetchDatasets(mockClient, mockMode)).rejects.toThrow(
      "Authentication error during fetching datasets: Unauthorized"
    );
  });

  it("should handle network errors", async () => {
    mockClient.GET.mockRejectedValue(
      new TypeError("fetch failed: ECONNREFUSED")
    );

    await expect(fetchDatasets(mockClient, mockMode)).rejects.toThrow(
      "Network error during fetching datasets: Unable to connect to Phoenix server"
    );
  });

  it("should handle errors when fetching examples", async () => {
    // Mock successful datasets fetch
    mockClient.GET.mockResolvedValueOnce({
      data: {
        data: [
          {
            id: "dataset-1",
            name: "test-dataset",
            description: null,
            metadata: {},
            created_at: "2025-01-01T00:00:00Z",
            updated_at: "2025-01-01T00:00:00Z",
          },
        ],
        next_cursor: null,
      },
    });

    // Mock error when fetching examples
    mockClient.GET.mockRejectedValueOnce(
      new Error("localhost:6006: 404 Not Found")
    );

    await expect(fetchDatasets(mockClient, mockMode)).rejects.toThrow(
      "Client error during fetching examples for dataset test-dataset: 404 Not Found"
    );
  });
});

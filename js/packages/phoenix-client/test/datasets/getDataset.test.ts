import { describe, it, expect, vi, beforeEach } from "vitest";
import { getDataset } from "../../src/datasets/getDataset";
import * as getDatasetInfoModule from "../../src/datasets/getDatasetInfo";
import * as getDatasetExamplesModule from "../../src/datasets/getDatasetExamples";

const mockDatasetInfo = {
  id: "dataset-123",
  name: "Test Dataset",
  description: "A test dataset",
  metadata: { foo: "bar" },
};

const mockDatasetExamples = {
  versionId: "v1",
  examples: [
    {
      id: "ex-1",
      updatedAt: new Date("2024-01-01T00:00:00Z"),
      input: { text: "input1" },
      output: { text: "output1" },
      metadata: {},
    },
    {
      id: "ex-2",
      updatedAt: new Date("2024-01-02T00:00:00Z"),
      input: { text: "input2" },
      output: { text: "output2" },
      metadata: {},
    },
  ],
};

const mockDatasetExamplesV2 = {
  versionId: "v2",
  examples: [
    {
      id: "ex-3",
      updatedAt: new Date("2024-01-03T00:00:00Z"),
      input: { text: "input3" },
      output: { text: "output3" },
      metadata: {},
    },
  ],
};

describe("getDataset", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return merged dataset info and examples", async () => {
    vi.spyOn(getDatasetInfoModule, "getDatasetInfo").mockResolvedValue(
      mockDatasetInfo
    );
    vi.spyOn(getDatasetExamplesModule, "getDatasetExamples").mockResolvedValue(
      mockDatasetExamples
    );

    const dataset = await getDataset({ dataset: { datasetId: "dataset-123" } });
    expect(dataset).toBeDefined();
    expect(dataset.id).toBe("dataset-123");
    expect(dataset.name).toBe("Test Dataset");
    expect(dataset.versionId).toBe("v1");
    const examples = dataset.examples;
    expect(examples.length).toBe(2);
    expect(examples[0]?.id).toBe("ex-1");
    expect(examples[1]?.id).toBe("ex-2");
  });

  it("should support getting dataset by version ID", async () => {
    const getDatasetExamplesSpy = vi
      .spyOn(getDatasetExamplesModule, "getDatasetExamples")
      .mockResolvedValue(mockDatasetExamplesV2);
    vi.spyOn(getDatasetInfoModule, "getDatasetInfo").mockResolvedValue(
      mockDatasetInfo
    );

    const dataset = await getDataset({
      dataset: { datasetId: "dataset-123" },
      versionId: "v2",
    });

    expect(getDatasetExamplesSpy).toHaveBeenCalledWith({
      client: expect.any(Object),
      dataset: { datasetId: "dataset-123" },
      versionId: "v2",
    });
    expect(dataset.versionId).toBe("v2");
    expect(dataset.examples.length).toBe(1);
    expect(dataset.examples[0]?.id).toBe("ex-3");
  });

  it("should work without versionId (uses latest version)", async () => {
    vi.spyOn(getDatasetInfoModule, "getDatasetInfo").mockResolvedValue(
      mockDatasetInfo
    );
    vi.spyOn(getDatasetExamplesModule, "getDatasetExamples").mockResolvedValue(
      mockDatasetExamples
    );

    const dataset = await getDataset({
      dataset: { datasetId: "dataset-123" },
    });

    expect(dataset.versionId).toBe("v1");
    expect(dataset.examples.length).toBe(2);
  });

  it("should propagate errors from getDatasetInfo", async () => {
    vi.spyOn(getDatasetInfoModule, "getDatasetInfo").mockRejectedValue(
      new Error("info error")
    );
    vi.spyOn(getDatasetExamplesModule, "getDatasetExamples").mockResolvedValue(
      mockDatasetExamples
    );
    await expect(
      getDataset({ dataset: { datasetId: "dataset-123" } })
    ).rejects.toThrow("info error");
  });

  it("should propagate errors from getDatasetExamples", async () => {
    vi.spyOn(getDatasetInfoModule, "getDatasetInfo").mockResolvedValue(
      mockDatasetInfo
    );
    vi.spyOn(getDatasetExamplesModule, "getDatasetExamples").mockRejectedValue(
      new Error("examples error")
    );
    await expect(
      getDataset({ dataset: { datasetId: "dataset-123" } })
    ).rejects.toThrow("examples error");
  });

  it("should return merged dataset info and examples when getting by name", async () => {
    vi.spyOn(getDatasetInfoModule, "getDatasetInfo").mockResolvedValue(
      mockDatasetInfo
    );
    vi.spyOn(getDatasetExamplesModule, "getDatasetExamples").mockResolvedValue(
      mockDatasetExamples
    );

    const dataset = await getDataset({
      dataset: { datasetName: "Test Dataset" },
    });
    expect(dataset).toBeDefined();
    expect(dataset.id).toBe("dataset-123");
    expect(dataset.name).toBe("Test Dataset");
    expect(dataset.versionId).toBe("v1");
    const examples = dataset.examples;
    expect(examples.length).toBe(2);
    expect(examples[0]?.id).toBe("ex-1");
    expect(examples[1]?.id).toBe("ex-2");
  });
});

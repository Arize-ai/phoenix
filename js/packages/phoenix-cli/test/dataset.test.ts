import {
  type DatasetExamplesData,
  formatDatasetExamplesOutput,
} from "../src/commands/formatDataset";

import { describe, expect, it } from "vitest";

// Mock dataset examples data
const mockDatasetExamples: DatasetExamplesData = {
  dataset_id: "RGF0YXNldDox",
  version_id: "RGF0YXNldFZlcnNpb246MQ==",
  examples: [
    {
      id: "RGF0YXNldEV4YW1wbGU6MQ==",
      input: { query: "Whatcha got for a 30 min eggs and cheese dinner?" },
      output: {
        response: "Here's a quick and delicious Egg & Cheese recipe...",
      },
      metadata: {},
      updated_at: "2026-01-14T22:33:20.899176+00:00",
    },
    {
      id: "RGF0YXNldEV4YW1wbGU6Mg==",
      input: { query: "Looking for quick salmon dinner ideas with lemon!" },
      output: { response: "Try this Lemon Herb Salmon recipe..." },
      metadata: { category: "seafood" },
      updated_at: "2026-01-14T22:33:22.049072+00:00",
    },
  ],
};

const mockDatasetExamplesWithSplits: DatasetExamplesData = {
  dataset_id: "RGF0YXNldDox",
  version_id: "RGF0YXNldFZlcnNpb246MQ==",
  filtered_splits: ["train", "test"],
  examples: [mockDatasetExamples.examples[0]],
};

const mockEmptyDataset: DatasetExamplesData = {
  dataset_id: "RGF0YXNldDoy",
  version_id: "RGF0YXNldFZlcnNpb246Mg==",
  examples: [],
};

describe("Dataset Examples Formatting", () => {
  describe("formatDatasetExamplesOutput - raw", () => {
    it("should format as compact JSON", () => {
      const output = formatDatasetExamplesOutput({
        data: mockDatasetExamples,
        format: "raw",
      });

      expect(output).toBe(JSON.stringify(mockDatasetExamples));
      expect(output).not.toContain("\n");
    });

    it("should handle empty examples", () => {
      const output = formatDatasetExamplesOutput({
        data: mockEmptyDataset,
        format: "raw",
      });

      const parsed = JSON.parse(output);
      expect(parsed.examples).toHaveLength(0);
    });
  });

  describe("formatDatasetExamplesOutput - json", () => {
    it("should format as pretty JSON", () => {
      const output = formatDatasetExamplesOutput({
        data: mockDatasetExamples,
        format: "json",
      });

      expect(output).toBe(JSON.stringify(mockDatasetExamples, null, 2));
      expect(output).toContain("\n");
      expect(output).toContain("  ");
    });

    it("should include all fields", () => {
      const output = formatDatasetExamplesOutput({
        data: mockDatasetExamples,
        format: "json",
      });

      const parsed = JSON.parse(output);
      expect(parsed.dataset_id).toBe("RGF0YXNldDox");
      expect(parsed.version_id).toBe("RGF0YXNldFZlcnNpb246MQ==");
      expect(parsed.examples).toHaveLength(2);
    });
  });

  describe("formatDatasetExamplesOutput - pretty", () => {
    it("should format dataset in human-readable format", () => {
      const output = formatDatasetExamplesOutput({
        data: mockDatasetExamples,
        datasetName: "query_response",
        format: "pretty",
      });

      expect(output).toContain("Dataset: query_response (RGF0YXNldDox)");
      expect(output).toContain("Version: RGF0YXNldFZlcnNpb246MQ==");
      expect(output).toContain("Examples: 2");
      expect(output).toContain("┌─ Example: RGF0YXNldEV4YW1wbGU6MQ==");
      expect(output).toContain("│  Input:");
      expect(output).toContain("│  Output:");
      expect(output).toContain("└─");
    });

    it("should show dataset ID if no name provided", () => {
      const output = formatDatasetExamplesOutput({
        data: mockDatasetExamples,
        format: "pretty",
      });

      expect(output).toContain("Dataset: RGF0YXNldDox (RGF0YXNldDox)");
    });

    it("should show split filters when present", () => {
      const output = formatDatasetExamplesOutput({
        data: mockDatasetExamplesWithSplits,
        datasetName: "query_response",
        format: "pretty",
      });

      expect(output).toContain("Splits: train, test");
    });

    it("should show metadata when present", () => {
      const output = formatDatasetExamplesOutput({
        data: mockDatasetExamples,
        format: "pretty",
      });

      expect(output).toContain('Metadata: {"category":"seafood"}');
    });

    it("should handle empty examples", () => {
      const output = formatDatasetExamplesOutput({
        data: mockEmptyDataset,
        datasetName: "empty_dataset",
        format: "pretty",
      });

      expect(output).toContain("Dataset: empty_dataset");
      expect(output).toContain("Examples: 0");
      expect(output).toContain("No examples found");
    });

    it("should truncate long input/output values", () => {
      const longValue = { query: "a".repeat(200) };
      const dataWithLongInput: DatasetExamplesData = {
        dataset_id: "RGF0YXNldDox",
        version_id: "RGF0YXNldFZlcnNpb246MQ==",
        examples: [
          {
            id: "example-1",
            input: longValue,
            output: { response: "short" },
            metadata: {},
            updated_at: "2026-01-14T22:33:20.899176+00:00",
          },
        ],
      };

      const output = formatDatasetExamplesOutput({
        data: dataWithLongInput,
        format: "pretty",
      });

      // Should be truncated with ellipsis
      expect(output).toContain("…");
    });
  });

  describe("defaults", () => {
    it("should default to pretty format", () => {
      const output = formatDatasetExamplesOutput({
        data: mockDatasetExamples,
      });

      expect(output).toContain("Dataset:");
      expect(output).toContain("┌─ Example:");
    });
  });
});

import type { componentsV1 } from "@arizeai/phoenix-client";

import {
  formatDatasetOutput,
  formatDatasetsOutput,
} from "../src/commands/formatDatasets";

import { describe, expect, it } from "vitest";

type Dataset = componentsV1["schemas"]["Dataset"];

// Mock dataset data
const mockDataset1: Dataset = {
  id: "abc123def456",
  name: "test-dataset",
  description: "A test dataset for unit tests",
  metadata: {},
  created_at: "2026-01-15T10:00:00.000Z",
  updated_at: "2026-01-15T12:00:00.000Z",
  example_count: 100,
};

const mockDataset2: Dataset = {
  id: "xyz789ghi012",
  name: "another-dataset",
  description: null,
  metadata: { key: "value" },
  created_at: "2026-01-14T08:00:00.000Z",
  updated_at: "2026-01-14T09:00:00.000Z",
  example_count: 50,
};

describe("Dataset Formatting", () => {
  describe("formatDatasetsOutput - raw", () => {
    it("should format as compact JSON", () => {
      const output = formatDatasetsOutput({
        datasets: [mockDataset1],
        format: "raw",
      });

      expect(output).toBe(JSON.stringify([mockDataset1]));
      expect(output).not.toContain("\n");
    });

    it("should handle empty array", () => {
      const output = formatDatasetsOutput({ datasets: [], format: "raw" });

      expect(output).toBe("[]");
    });
  });

  describe("formatDatasetsOutput - json", () => {
    it("should format as pretty JSON", () => {
      const output = formatDatasetsOutput({
        datasets: [mockDataset1],
        format: "json",
      });

      expect(output).toBe(JSON.stringify([mockDataset1], null, 2));
      expect(output).toContain("\n");
      expect(output).toContain("  ");
    });

    it("should handle multiple datasets", () => {
      const output = formatDatasetsOutput({
        datasets: [mockDataset1, mockDataset2],
        format: "json",
      });

      expect(output).toBe(
        JSON.stringify([mockDataset1, mockDataset2], null, 2)
      );
    });
  });

  describe("formatDatasetsOutput - pretty", () => {
    it("should format datasets in human-readable format", () => {
      const output = formatDatasetsOutput({
        datasets: [mockDataset1],
        format: "pretty",
      });

      expect(output).toContain("Datasets:");
      expect(output).toContain("┌─ test-dataset (abc123def456)");
      expect(output).toContain("│  Examples: 100");
      expect(output).toContain("│  Description: — A test dataset for unit tests");
      expect(output).toContain("└─");
    });

    it("should handle datasets without description", () => {
      const output = formatDatasetsOutput({
        datasets: [mockDataset2],
        format: "pretty",
      });

      expect(output).toContain("┌─ another-dataset (xyz789ghi012)");
      expect(output).toContain("│  Examples: 50");
      expect(output).not.toContain("Description:");
    });

    it("should handle empty array", () => {
      const output = formatDatasetsOutput({ datasets: [], format: "pretty" });

      expect(output).toBe("No datasets found");
    });

    it("should format multiple datasets", () => {
      const output = formatDatasetsOutput({
        datasets: [mockDataset1, mockDataset2],
        format: "pretty",
      });

      expect(output).toContain("┌─ test-dataset (abc123def456)");
      expect(output).toContain("┌─ another-dataset (xyz789ghi012)");
    });
  });

  describe("formatDatasetOutput", () => {
    it("should format single dataset as raw JSON", () => {
      const output = formatDatasetOutput({
        dataset: mockDataset1,
        format: "raw",
      });

      expect(output).toBe(JSON.stringify(mockDataset1));
    });

    it("should format single dataset as pretty JSON", () => {
      const output = formatDatasetOutput({
        dataset: mockDataset1,
        format: "json",
      });

      expect(output).toBe(JSON.stringify(mockDataset1, null, 2));
    });

    it("should format single dataset in human-readable format", () => {
      const output = formatDatasetOutput({
        dataset: mockDataset1,
        format: "pretty",
      });

      expect(output).toContain("┌─ Dataset: test-dataset (abc123def456)");
      expect(output).toContain("│  Examples: 100");
      expect(output).toContain("└─");
    });
  });
});

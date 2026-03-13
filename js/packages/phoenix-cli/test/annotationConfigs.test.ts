import type { componentsV1 } from "@arizeai/phoenix-client";
import { describe, expect, it } from "vitest";

import { formatAnnotationConfigsOutput } from "../src/commands/formatAnnotationConfigs";

type CategoricalAnnotationConfig =
  componentsV1["schemas"]["CategoricalAnnotationConfig"];
type ContinuousAnnotationConfig =
  componentsV1["schemas"]["ContinuousAnnotationConfig"];
type FreeformAnnotationConfig =
  componentsV1["schemas"]["FreeformAnnotationConfig"];

const mockCategorical: CategoricalAnnotationConfig = {
  id: "cat-id-001",
  name: "quality",
  type: "CATEGORICAL",
  description: "Quality rating",
  optimization_direction: "MAXIMIZE",
  values: [
    { label: "good", score: 1 },
    { label: "bad", score: 0 },
  ],
};

const mockContinuous: ContinuousAnnotationConfig = {
  id: "cont-id-002",
  name: "score",
  type: "CONTINUOUS",
  description: null,
  optimization_direction: "MAXIMIZE",
  lower_bound: 0,
  upper_bound: 1,
};

const mockFreeform: FreeformAnnotationConfig = {
  id: "free-id-003",
  name: "notes",
  type: "FREEFORM",
  description: "Free-text notes",
};

describe("Annotation Config Formatting", () => {
  describe("formatAnnotationConfigsOutput - raw", () => {
    it("should format as compact JSON", () => {
      const output = formatAnnotationConfigsOutput({
        configs: [mockCategorical],
        format: "raw",
      });

      expect(output).toBe(JSON.stringify([mockCategorical]));
      expect(output).not.toContain("\n");
    });

    it("should handle empty array", () => {
      const output = formatAnnotationConfigsOutput({
        configs: [],
        format: "raw",
      });

      expect(output).toBe("[]");
    });
  });

  describe("formatAnnotationConfigsOutput - json", () => {
    it("should format as pretty JSON", () => {
      const output = formatAnnotationConfigsOutput({
        configs: [mockCategorical],
        format: "json",
      });

      expect(output).toBe(JSON.stringify([mockCategorical], null, 2));
      expect(output).toContain("\n");
      expect(output).toContain("  ");
    });

    it("should handle multiple configs", () => {
      const output = formatAnnotationConfigsOutput({
        configs: [mockCategorical, mockContinuous, mockFreeform],
        format: "json",
      });

      expect(output).toBe(
        JSON.stringify([mockCategorical, mockContinuous, mockFreeform], null, 2)
      );
    });
  });

  describe("formatAnnotationConfigsOutput - pretty", () => {
    it("should format configs as a table with column headers", () => {
      const output = formatAnnotationConfigsOutput({
        configs: [mockCategorical],
        format: "pretty",
      });

      expect(output).toContain("name");
      expect(output).toContain("quality");
      expect(output).toContain("cat-id-001");
      expect(output).toContain("CATEGORICAL");
      expect(output).toContain("Quality rating");
      // table borders
      expect(output).toContain("┌");
      expect(output).toContain("┘");
    });

    it("should handle null description as empty string", () => {
      const output = formatAnnotationConfigsOutput({
        configs: [mockContinuous],
        format: "pretty",
      });

      expect(output).toContain("score");
      expect(output).toContain("cont-id-002");
      expect(output).toContain("CONTINUOUS");
    });

    it("should render freeform type", () => {
      const output = formatAnnotationConfigsOutput({
        configs: [mockFreeform],
        format: "pretty",
      });

      expect(output).toContain("notes");
      expect(output).toContain("free-id-003");
      expect(output).toContain("FREEFORM");
      expect(output).toContain("Free-text notes");
    });

    it("should return empty message when no configs", () => {
      const output = formatAnnotationConfigsOutput({
        configs: [],
        format: "pretty",
      });

      expect(output).toBe("No annotation configs found");
    });

    it("should format multiple configs", () => {
      const output = formatAnnotationConfigsOutput({
        configs: [mockCategorical, mockFreeform],
        format: "pretty",
      });

      expect(output).toContain("quality");
      expect(output).toContain("notes");
    });

    it("should default to pretty format when format is undefined", () => {
      const output = formatAnnotationConfigsOutput({
        configs: [mockCategorical],
      });

      expect(output).toContain("name");
      expect(output).toContain("quality");
    });
  });
});

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
  id: "Q2F0ZWdvcmljYWxBbm5vdGF0aW9uQ29uZmlnOjE=",
  name: "quality",
  type: "CATEGORICAL",
  description: "Rate response quality",
  optimization_direction: "MAXIMIZE",
  values: [
    { label: "good", score: 1 },
    { label: "bad", score: 0 },
  ],
};

const mockContinuous: ContinuousAnnotationConfig = {
  id: "Q29udGludW91c0Fubm90YXRpb25Db25maWc6Mg==",
  name: "relevance",
  type: "CONTINUOUS",
  description: null,
  optimization_direction: "MAXIMIZE",
  lower_bound: 0,
  upper_bound: 1,
};

const mockFreeform: FreeformAnnotationConfig = {
  id: "RnJlZWZvcm1Bbm5vdGF0aW9uQ29uZmlnOjM=",
  name: "feedback",
  type: "FREEFORM",
  description: "Free-text feedback",
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
    it("should format categorical config in human-readable format", () => {
      const output = formatAnnotationConfigsOutput({
        configs: [mockCategorical],
        format: "pretty",
      });

      expect(output).toContain("Annotation Configs:");
      expect(output).toContain(
        `┌─ quality (Q2F0ZWdvcmljYWxBbm5vdGF0aW9uQ29uZmlnOjE=)`
      );
      expect(output).toContain("│  Type: CATEGORICAL — Rate response quality");
      expect(output).toContain("└─");
    });

    it("should format continuous config without description", () => {
      const output = formatAnnotationConfigsOutput({
        configs: [mockContinuous],
        format: "pretty",
      });

      expect(output).toContain(
        `┌─ relevance (Q29udGludW91c0Fubm90YXRpb25Db25maWc6Mg==)`
      );
      expect(output).toContain("│  Type: CONTINUOUS");
      expect(output).not.toContain(" — ");
    });

    it("should format freeform config with description", () => {
      const output = formatAnnotationConfigsOutput({
        configs: [mockFreeform],
        format: "pretty",
      });

      expect(output).toContain(
        `┌─ feedback (RnJlZWZvcm1Bbm5vdGF0aW9uQ29uZmlnOjM=)`
      );
      expect(output).toContain("│  Type: FREEFORM — Free-text feedback");
    });

    it("should handle empty array", () => {
      const output = formatAnnotationConfigsOutput({
        configs: [],
        format: "pretty",
      });

      expect(output).toBe("No annotation configs found");
    });

    it("should format multiple configs", () => {
      const output = formatAnnotationConfigsOutput({
        configs: [mockCategorical, mockContinuous, mockFreeform],
        format: "pretty",
      });

      expect(output).toContain("┌─ quality");
      expect(output).toContain("┌─ relevance");
      expect(output).toContain("┌─ feedback");
    });

    it("should default to pretty format when no format specified", () => {
      const output = formatAnnotationConfigsOutput({
        configs: [mockCategorical],
      });

      expect(output).toContain("Annotation Configs:");
    });
  });
});

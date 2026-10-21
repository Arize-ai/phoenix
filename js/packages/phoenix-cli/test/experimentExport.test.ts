import { describe, expect, it } from "vitest";

import { normalizeExperimentExportFormat } from "../src/commands/experiment";

describe("normalizeExperimentExportFormat", () => {
  it("defaults to json when the flag is unset", () => {
    expect(normalizeExperimentExportFormat(undefined)).toBe("json");
  });

  it("accepts json", () => {
    expect(normalizeExperimentExportFormat("json")).toBe("json");
  });

  it("accepts csv", () => {
    expect(normalizeExperimentExportFormat("csv")).toBe("csv");
  });

  it("is case- and whitespace-insensitive", () => {
    expect(normalizeExperimentExportFormat("  CSV ")).toBe("csv");
  });

  it("throws a clear error on an unsupported format", () => {
    expect(() => normalizeExperimentExportFormat("xml")).toThrow(
      /Supported formats: csv, json/
    );
  });
});

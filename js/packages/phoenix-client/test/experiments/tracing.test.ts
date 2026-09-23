import { describe, expect, it } from "vitest";

import { getTraceExportUrl } from "../../src/experiments/tracing";

describe("getTraceExportUrl", () => {
  it("exports to an explicitly configured base URL", () => {
    expect(
      getTraceExportUrl({
        baseUrl: "http://explicit",
        baseUrlSource: "explicit",
      })
    ).toBe("http://explicit");
  });

  // Returning undefined hands resolution to register(), which reads the full
  // trace-export chain — the collector variable, the OTel-standard variables,
  // then PHOENIX_ENDPOINT.
  it("defers to the environment when the base URL came from the environment", () => {
    expect(
      getTraceExportUrl({
        baseUrl: "http://from-env",
        baseUrlSource: "environment",
      })
    ).toBeUndefined();
  });

  it("defers to the environment when the base URL is the built-in default", () => {
    expect(
      getTraceExportUrl({
        baseUrl: "http://localhost:6006",
        baseUrlSource: "default",
      })
    ).toBeUndefined();
  });

  // Only deliberate configuration puts a URL on a hand-built client.
  it("treats a base URL of unknown provenance as explicit", () => {
    expect(getTraceExportUrl({ baseUrl: "http://hand-built" })).toBe(
      "http://hand-built"
    );
  });
});

import { describe, expect, it } from "vitest";

import { createOpenApiHandlers, getOpenApiDocument } from "../src/index.js";

/** Narrows an OpenAPI document node to a string-keyed object. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

describe("getOpenApiDocument", () => {
  it("points the document's servers at the given base URL", () => {
    const document = getOpenApiDocument({
      baseUrl: "https://phoenix.example.com",
    });
    expect(document.servers).toEqual([{ url: "https://phoenix.example.com" }]);
  });

  it("returns a copy so callers cannot mutate the workspace document", () => {
    const first = getOpenApiDocument();
    const second = getOpenApiDocument();
    expect(first).not.toBe(second);
  });
});

describe("createOpenApiHandlers", () => {
  it("creates a handler for every operation in the OpenAPI definition", async () => {
    const handlers = await createOpenApiHandlers();
    const document = getOpenApiDocument();
    const paths = document.paths;
    if (!isRecord(paths)) {
      throw new Error("Expected the OpenAPI document to have a paths object");
    }
    const operationCount = Object.values(paths)
      .filter(isRecord)
      .map((operations) => Object.keys(operations).length)
      .reduce((total, count) => total + count, 0);
    expect(operationCount).toBeGreaterThan(0);
    expect(handlers.length).toBeGreaterThanOrEqual(operationCount);
  });
});

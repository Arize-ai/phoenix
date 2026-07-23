import { describe, expect, it } from "vitest";

import { createOpenApiHandlers, getOpenApiDocument } from "../src/index.js";

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
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- OpenAPI paths object shape is known
    const paths = document.paths as Record<string, Record<string, unknown>>;
    const operationCount = Object.values(paths)
      .map((operations) => Object.keys(operations).length)
      .reduce((total, count) => total + count, 0);
    expect(handlers.length).toBeGreaterThanOrEqual(operationCount);
  });
});

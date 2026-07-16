import { describe, expect, it } from "vitest";

import {
  createPhoenixOpenApiHandlers,
  getPhoenixOpenApiDocument,
} from "../src/index.js";

describe("getPhoenixOpenApiDocument", () => {
  it("points the document's servers at the given base URL", () => {
    const document = getPhoenixOpenApiDocument({
      baseUrl: "https://phoenix.example.com",
    });
    expect(document.servers).toEqual([{ url: "https://phoenix.example.com" }]);
  });

  it("returns a copy so callers cannot mutate the workspace document", () => {
    const first = getPhoenixOpenApiDocument();
    const second = getPhoenixOpenApiDocument();
    expect(first).not.toBe(second);
  });
});

describe("createPhoenixOpenApiHandlers", () => {
  it("creates a handler for every operation in the OpenAPI definition", async () => {
    const handlers = await createPhoenixOpenApiHandlers();
    const document = getPhoenixOpenApiDocument();
    const paths = document.paths as Record<string, Record<string, unknown>>;
    const operationCount = Object.values(paths)
      .map((operations) => Object.keys(operations).length)
      .reduce((total, count) => total + count, 0);
    expect(handlers.length).toBeGreaterThanOrEqual(operationCount);
  });
});

import { test, expect, describe } from "vitest";
import { register, ensureCollectorEndpoint } from "../src/register";

describe("register", () => {
  test("should register a provider", () => {
    const provider = register({
      url: "http://localhost:6006/v1/traces",
      apiKey: "test",
    });
    expect(provider).toBeDefined();
    expect(provider["_registeredSpanProcessors"].length).toBe(1);
    expect(Object.keys(provider["_registeredSpanProcessors"]).length).toBe(1);
  });
});

test.each([
  ["http://localhost:6006", "http://localhost:6006/v1/traces"],
  ["http://localhost:6006/v1/traces", "http://localhost:6006/v1/traces"],
  ["http://localhost:6006/v1/traces/", "http://localhost:6006/v1/traces/"],
])("ensureCollectorEndpoint(%0) should return %1", (url, collectorURL) => {
  expect(ensureCollectorEndpoint(url)).toBe(collectorURL);
});

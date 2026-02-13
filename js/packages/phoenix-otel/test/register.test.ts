import { DiagLogLevel } from "../src";
import { ensureCollectorEndpoint, register } from "../src/register";

import { describe, expect, test } from "vitest";

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

  test("should accept diag log level from package exports", () => {
    const provider = register({
      url: "http://localhost:6006/v1/traces",
      apiKey: "test",
      diagLogLevel: DiagLogLevel.DEBUG,
      global: false,
    });
    expect(provider).toBeDefined();
  });
});

test("should export DiagLogLevel as a runtime value", () => {
  expect(DiagLogLevel.DEBUG).toBeDefined();
  expect(typeof DiagLogLevel.DEBUG).toBe("number");
});

test.each([
  ["http://localhost:6006", "http://localhost:6006/v1/traces"],
  ["http://localhost:6006/v1/traces", "http://localhost:6006/v1/traces"],
  ["http://localhost:6006/v1/traces/", "http://localhost:6006/v1/traces/"],
  [
    "https://app.phoenix.arize.com/s/my-space",
    "https://app.phoenix.arize.com/s/my-space/v1/traces",
  ],
  [
    "https://app.phoenix.arize.com/s/my-space/v1/traces",
    "https://app.phoenix.arize.com/s/my-space/v1/traces",
  ],
])("ensureCollectorEndpoint(%0) should return %1", (url, collectorURL) => {
  expect(ensureCollectorEndpoint(url)).toBe(collectorURL);
});

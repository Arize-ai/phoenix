import { test, expect, describe } from "vitest";
import { register } from "../src";

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

import { describe, expect, it } from "vitest";

import { isEndpointUrl, normalizeEndpoint } from "../src/validation/endpoint";

describe("isEndpointUrl", () => {
  it("accepts absolute http and https URLs", () => {
    expect(isEndpointUrl("http://localhost:6006")).toBe(true);
    expect(isEndpointUrl("https://phoenix.example.com/subpath")).toBe(true);
    expect(isEndpointUrl("  http://localhost:6006  ")).toBe(true);
  });

  it("rejects scheme-less input", () => {
    expect(isEndpointUrl("localhost:6006")).toBe(false);
  });

  it("rejects non-HTTP schemes and non-URLs", () => {
    expect(isEndpointUrl("ftp://phoenix.example.com")).toBe(false);
    expect(isEndpointUrl("mailto:someone@example.com")).toBe(false);
    expect(isEndpointUrl("")).toBe(false);
    expect(isEndpointUrl("not a url")).toBe(false);
  });
});

describe("normalizeEndpoint", () => {
  it("normalizes to origin plus path, no trailing slash", () => {
    expect(normalizeEndpoint(" http://localhost:6006/ ")).toBe(
      "http://localhost:6006"
    );
    expect(normalizeEndpoint("https://phoenix.example.com/subpath/")).toBe(
      "https://phoenix.example.com/subpath"
    );
  });

  it("throws on anything that is not an endpoint URL", () => {
    expect(() => normalizeEndpoint("localhost:6006")).toThrow(TypeError);
    expect(() => normalizeEndpoint("ftp://phoenix.example.com")).toThrow(
      TypeError
    );
  });
});

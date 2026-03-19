import { suppressTracing as originalSuppressTracing } from "@opentelemetry/core";
import { describe, expect, test } from "vitest";

import { suppressTracing } from "../src";

describe("suppressTracing re-export", () => {
  test("should be re-exported from the package", () => {
    expect(suppressTracing).toBeDefined();
    expect(typeof suppressTracing).toBe("function");
  });

  test("should be the same function as @opentelemetry/core suppressTracing", () => {
    expect(suppressTracing).toBe(originalSuppressTracing);
  });
});

import { describe, expect, it } from "vitest";

import { logAnnotation, logOutput, wrapEvaluator } from "../src/core/helpers";

describe("helpers outside a test context", () => {
  it("logOutput throws when called outside a phoenix test", () => {
    expect(() => logOutput({ foo: 1 })).toThrowError(
      /must be called inside a phoenix-test test body/
    );
  });

  it("logAnnotation throws when called outside a phoenix test", () => {
    expect(() => logAnnotation({ name: "x", score: 1 })).toThrowError(
      /must be called inside a phoenix-test test body/
    );
  });

  it("wrapEvaluator runs the function plainly outside a test context", async () => {
    const wrapped = wrapEvaluator(async ({ x }: { x: number }) => x + 1);
    const result = await wrapped({ x: 41 });
    expect(result).toBe(42);
  });
});

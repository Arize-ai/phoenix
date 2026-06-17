import { describe, expect, it } from "vitest";

import {
  evaluate,
  logAnnotation,
  recordOutput,
  traceEvaluator,
} from "../../src/testing/helpers";

describe("helpers outside a test context", () => {
  it("recordOutput throws when called outside a phoenix test", () => {
    expect(() => recordOutput({ foo: 1 })).toThrowError(
      /must be called inside a Phoenix eval test body/
    );
  });

  it("logAnnotation throws when called outside a phoenix test", () => {
    expect(() => logAnnotation({ name: "x", score: 1 })).toThrowError(
      /must be called inside a Phoenix eval test body/
    );
  });

  it("traceEvaluator runs the function plainly outside a test context", async () => {
    const wrapped = traceEvaluator(async ({ x }: { x: number }) => x + 1);
    const result = await wrapped({ x: 41 });
    expect(result).toBe(42);
  });

  it("evaluate runs the evaluator plainly outside a test context", async () => {
    const result = await evaluate(
      {
        name: "outside",
        evaluate: ({ x }: { x: number }) => ({ score: x + 1 }),
      },
      { x: 41 }
    );

    expect(result).toEqual({ score: 42 });
  });
});

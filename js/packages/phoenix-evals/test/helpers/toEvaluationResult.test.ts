import { toEvaluationResult } from "../../src/helpers/toEvaluationResult";

import { describe, expect, it } from "vitest";

describe("toEvaluationResult", () => {
  it("should convert a number to EvaluationResult with score", () => {
    expect(toEvaluationResult(0.95)).toEqual({ score: 0.95 });
    expect(toEvaluationResult(0)).toEqual({ score: 0 });
    expect(toEvaluationResult(-1)).toEqual({ score: -1 });
  });

  it("should convert a string to EvaluationResult with label", () => {
    expect(toEvaluationResult("correct")).toEqual({ label: "correct" });
    expect(toEvaluationResult("")).toEqual({ label: "" });
  });

  it("should convert an object with score only", () => {
    const result = toEvaluationResult({ score: 0.8 });
    expect(result).toEqual({ score: 0.8 });
    expect(result.label).toBeUndefined();
    expect(result.explanation).toBeUndefined();
  });

  it("should convert an object with label only", () => {
    const result = toEvaluationResult({ label: "pass" });
    expect(result).toEqual({ label: "pass" });
    expect(result.score).toBeUndefined();
    expect(result.explanation).toBeUndefined();
  });

  it("should convert an object with all properties", () => {
    const result = toEvaluationResult({
      score: 0.95,
      label: "excellent",
      explanation: "Perfect output quality",
    });

    expect(result).toEqual({
      score: 0.95,
      label: "excellent",
      explanation: "Perfect output quality",
    });
  });

  it("should ignore extra properties in object", () => {
    const result = toEvaluationResult({
      score: 0.8,
      label: "good",
      extraField: "should be ignored",
      anotherField: 123,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    expect(result).toEqual({ score: 0.8, label: "good" });
    expect(result).not.toHaveProperty("extraField");
    expect(result).not.toHaveProperty("anotherField");
  });

  it("should handle invalid property types", () => {
    expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      toEvaluationResult({ score: "not a number" as any })
    ).toEqual({});
    expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      toEvaluationResult({ label: 123 as any })
    ).toEqual({});
  });

  it("should return empty object for null, undefined, and other types", () => {
    expect(toEvaluationResult(null)).toEqual({});
    expect(toEvaluationResult(undefined)).toEqual({});
    expect(toEvaluationResult(true)).toEqual({});
    expect(toEvaluationResult([])).toEqual({});
    expect(toEvaluationResult({})).toEqual({});
  });
});

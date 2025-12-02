import { asEvaluatorFn } from "../../src/helpers/asEvaluatorFn";
import { EvaluationResult } from "../../src/types";

import { describe, expect, it } from "vitest";

type TestRecord = {
  input: string;
  output: string;
  [key: string]: unknown;
};

describe("asEvaluatorFn", () => {
  describe("synchronous functions", () => {
    it("should convert a sync function returning a number to an evaluator function", async () => {
      const fn = ({
        output,
        expected,
      }: {
        output: string;
        expected: string;
      }) => {
        return output === expected ? 1 : 0;
      };

      const evaluatorFn = asEvaluatorFn<TestRecord>(fn);

      const result = await evaluatorFn({
        input: "test",
        output: "correct",
        expected: "correct",
      });

      expect(result).toEqual({ score: 1 });
    });

    it("should convert a sync function returning 0 to an evaluator function", async () => {
      const fn = ({
        output,
        expected,
      }: {
        output: string;
        expected: string;
      }) => {
        return output === expected ? 1 : 0;
      };

      const evaluatorFn = asEvaluatorFn<TestRecord>(fn);

      const result = await evaluatorFn({
        input: "test",
        output: "wrong",
        expected: "correct",
      });

      expect(result).toEqual({ score: 0 });
    });

    it("should convert a sync function returning an EvaluationResult object", async () => {
      const fn = (_record: TestRecord): EvaluationResult => {
        return {
          score: 0.95,
          label: "high",
          explanation: "The output is of high quality",
        };
      };

      const evaluatorFn = asEvaluatorFn<TestRecord>(fn);

      const result = await evaluatorFn({
        input: "test",
        output: "some output",
      });

      expect(result).toEqual({
        score: 0.95,
        label: "high",
        explanation: "The output is of high quality",
      });
    });

    it("should convert a sync function returning a string (label)", async () => {
      const fn = ({ output }: { output: string }) => {
        return output.length > 10 ? "long" : "short";
      };

      const evaluatorFn = asEvaluatorFn<TestRecord>(fn);

      const result = await evaluatorFn({
        input: "test",
        output: "very long output text",
      });

      expect(result).toEqual({ label: "long" });
    });

    it("should convert a sync function returning an object with score only", async () => {
      const fn = (_record: TestRecord) => {
        return { score: 0.8 };
      };

      const evaluatorFn = asEvaluatorFn<TestRecord>(fn);

      const result = await evaluatorFn({
        input: "test",
        output: "some output",
      });

      expect(result).toEqual({ score: 0.8 });
    });

    it("should convert a sync function returning an object with label only", async () => {
      const fn = (_record: TestRecord) => {
        return { label: "pass" };
      };

      const evaluatorFn = asEvaluatorFn<TestRecord>(fn);

      const result = await evaluatorFn({
        input: "test",
        output: "some output",
      });

      expect(result).toEqual({ label: "pass" });
    });

    it("should convert a sync function returning an object with explanation only", async () => {
      const fn = (_record: TestRecord) => {
        return { explanation: "This is a test explanation" };
      };

      const evaluatorFn = asEvaluatorFn<TestRecord>(fn);

      const result = await evaluatorFn({
        input: "test",
        output: "some output",
      });

      expect(result).toEqual({ explanation: "This is a test explanation" });
    });

    it("should handle a sync function returning null", async () => {
      const fn = () => null;

      const evaluatorFn = asEvaluatorFn<TestRecord>(fn);

      const result = await evaluatorFn({
        input: "test",
        output: "some output",
      });

      expect(result).toEqual({});
    });

    it("should handle a sync function returning undefined", async () => {
      const fn = () => undefined;

      const evaluatorFn = asEvaluatorFn<TestRecord>(fn);

      const result = await evaluatorFn({
        input: "test",
        output: "some output",
      });

      expect(result).toEqual({});
    });

    it("should handle a sync function returning an empty object", async () => {
      const fn = () => ({});

      const evaluatorFn = asEvaluatorFn<TestRecord>(fn);

      const result = await evaluatorFn({
        input: "test",
        output: "some output",
      });

      expect(result).toEqual({});
    });
  });

  describe("asynchronous functions", () => {
    it("should convert an async function returning a number to an evaluator function", async () => {
      const fn = async ({
        output,
        expected,
      }: {
        output: string;
        expected: string;
      }) => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return output === expected ? 1 : 0;
      };

      const evaluatorFn = asEvaluatorFn<TestRecord>(fn);

      const result = await evaluatorFn({
        input: "test",
        output: "correct",
        expected: "correct",
      });

      expect(result).toEqual({ score: 1 });
    });

    it("should convert an async function returning an EvaluationResult object", async () => {
      const fn = async (_record: TestRecord): Promise<EvaluationResult> => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return {
          score: 0.85,
          label: "medium",
          explanation: "The output quality is medium",
        };
      };

      const evaluatorFn = asEvaluatorFn<TestRecord>(fn);

      const result = await evaluatorFn({
        input: "test",
        output: "some output",
      });

      expect(result).toEqual({
        score: 0.85,
        label: "medium",
        explanation: "The output quality is medium",
      });
    });

    it("should convert an async function returning a string (label)", async () => {
      const fn = async ({ output }: { output: string }) => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return output.length > 5 ? "long" : "short";
      };

      const evaluatorFn = asEvaluatorFn<TestRecord>(fn);

      const result = await evaluatorFn({
        input: "test",
        output: "very long output",
      });

      expect(result).toEqual({ label: "long" });
    });

    it("should handle an async function that throws an error", async () => {
      const fn = async () => {
        throw new Error("Test error");
      };

      const evaluatorFn = asEvaluatorFn<TestRecord>(fn);

      await expect(
        evaluatorFn({
          input: "test",
          output: "some output",
        })
      ).rejects.toThrow("Test error");
    });
  });

  describe("function arguments", () => {
    it("should pass the record argument to the original function", async () => {
      const fn = (record: TestRecord) => {
        return record.output === "expected" ? 1 : 0;
      };

      const evaluatorFn = asEvaluatorFn<TestRecord>(fn);

      const result1 = await evaluatorFn({
        input: "test",
        output: "expected",
      });

      expect(result1).toEqual({ score: 1 });

      const result2 = await evaluatorFn({
        input: "test",
        output: "unexpected",
      });

      expect(result2).toEqual({ score: 0 });
    });

    it("should handle functions with no parameters", async () => {
      const fn = () => 42;

      const evaluatorFn = asEvaluatorFn<TestRecord>(fn);

      const result = await evaluatorFn({
        input: "test",
        output: "some output",
      });

      expect(result).toEqual({ score: 42 });
    });
  });

  describe("edge cases", () => {
    it("should handle a function returning a negative number", async () => {
      const fn = () => -1;

      const evaluatorFn = asEvaluatorFn<TestRecord>(fn);

      const result = await evaluatorFn({
        input: "test",
        output: "some output",
      });

      expect(result).toEqual({ score: -1 });
    });

    it("should handle a function returning a floating point number", async () => {
      const fn = () => 0.123456789;

      const evaluatorFn = asEvaluatorFn<TestRecord>(fn);

      const result = await evaluatorFn({
        input: "test",
        output: "some output",
      });

      expect(result).toEqual({ score: 0.123456789 });
    });

    it("should handle a function returning Infinity", async () => {
      const fn = () => Infinity;

      const evaluatorFn = asEvaluatorFn<TestRecord>(fn);

      const result = await evaluatorFn({
        input: "test",
        output: "some output",
      });

      expect(result).toEqual({ score: Infinity });
    });

    it("should handle a function returning NaN", async () => {
      const fn = () => NaN;

      const evaluatorFn = asEvaluatorFn<TestRecord>(fn);

      const result = await evaluatorFn({
        input: "test",
        output: "some output",
      });

      expect(result).toEqual({ score: NaN });
    });

    it("should handle a function returning an object with all EvaluationResult fields", async () => {
      const fn = () => ({
        score: 0.9,
        label: "excellent",
        explanation: "Perfect output",
      });

      const evaluatorFn = asEvaluatorFn<TestRecord>(fn);

      const result = await evaluatorFn({
        input: "test",
        output: "some output",
      });

      expect(result).toEqual({
        score: 0.9,
        label: "excellent",
        explanation: "Perfect output",
      });
    });

    it("should handle a function returning an object with extra fields", async () => {
      const fn = () => ({
        score: 0.8,
        label: "good",
        extraField: "this should be ignored",
        anotherField: 123,
      });

      const evaluatorFn = asEvaluatorFn<TestRecord>(fn);

      const result = await evaluatorFn({
        input: "test",
        output: "some output",
      });

      // Only EvaluationResult fields should be included
      expect(result).toEqual({
        score: 0.8,
        label: "good",
      });
      expect(result).not.toHaveProperty("extraField");
      expect(result).not.toHaveProperty("anotherField");
    });

    it("should handle a function returning a boolean (converted to empty result)", async () => {
      const fn = () => true;

      const evaluatorFn = asEvaluatorFn<TestRecord>(fn);

      const result = await evaluatorFn({
        input: "test",
        output: "some output",
      });

      expect(result).toEqual({});
    });

    it("should handle a function returning an array (converted to empty result)", async () => {
      const fn = () => [1, 2, 3];

      const evaluatorFn = asEvaluatorFn<TestRecord>(fn);

      const result = await evaluatorFn({
        input: "test",
        output: "some output",
      });

      expect(result).toEqual({});
    });
  });

  describe("return type", () => {
    it("should always return a Promise", () => {
      const fn = () => 1;

      const evaluatorFn = asEvaluatorFn<TestRecord>(fn);

      const result = evaluatorFn({
        input: "test",
        output: "some output",
      });

      expect(result).toBeInstanceOf(Promise);
    });

    it("should return a Promise that resolves to EvaluationResult", async () => {
      const fn = () => ({ score: 0.5 });

      const evaluatorFn = asEvaluatorFn<TestRecord>(fn);

      const result = await evaluatorFn({
        input: "test",
        output: "some output",
      });

      expect(result).toHaveProperty("score");
      expect(typeof result.score).toBe("number");
    });
  });
});

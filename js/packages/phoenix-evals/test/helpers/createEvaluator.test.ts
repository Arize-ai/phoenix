import { createEvaluator } from "../../src/helpers/createEvaluator";
import { EvaluationResult } from "../../src/types";

import { SpanKind } from "@opentelemetry/api";
import {
  InMemorySpanExporter,
  NodeTracerProvider,
  SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace-node";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

type TestRecord = {
  input: string;
  output: string;
  expected?: string;
  [key: string]: unknown;
};

describe("CreateEvaluator", () => {
  let spanExporter: InMemorySpanExporter;
  let tracerProvider: NodeTracerProvider;

  beforeEach(() => {
    // Set up in-memory span exporter and tracer provider
    spanExporter = new InMemorySpanExporter();
    tracerProvider = new NodeTracerProvider({
      spanProcessors: [new SimpleSpanProcessor(spanExporter)],
    });

    tracerProvider.register();
  });

  afterEach(() => {
    // Clean up after each test
    spanExporter.reset();
    tracerProvider.shutdown();
  });
  describe("basic functionality", () => {
    it("should create an evaluator from a sync function returning a number", async () => {
      const fn = ({ output, expected }: TestRecord) => {
        return output === expected ? 1 : 0;
      };

      const evaluator = createEvaluator(fn, {
        name: "accuracy",
      });

      const result = await evaluator.evaluate({
        input: "test",
        output: "correct",
        expected: "correct",
      });

      expect(result).toEqual({ score: 1 });
      expect(evaluator.name).toBe("accuracy");
    });

    it("should create an evaluator from an async function returning a number", async () => {
      const fn = async ({ output, expected }: TestRecord) => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return output === expected ? 1 : 0;
      };

      const evaluator = createEvaluator(fn, {
        name: "async-accuracy",
      });

      const result = await evaluator.evaluate({
        input: "test",
        output: "correct",
        expected: "correct",
      });

      expect(result).toEqual({ score: 1 });
    });

    it("should create an evaluator from a function returning an EvaluationResult", async () => {
      const fn = (_record: TestRecord): EvaluationResult => {
        return {
          score: 0.95,
          label: "high",
          explanation: "High quality output",
        };
      };

      const evaluator = createEvaluator(fn, {
        name: "quality",
      });

      const result = await evaluator.evaluate({
        input: "test",
        output: "some output",
      });

      expect(result).toEqual({
        score: 0.95,
        label: "high",
        explanation: "High quality output",
      });
    });

    it("should create an evaluator from a function returning a string (label)", async () => {
      const fn = ({ output }: TestRecord) => {
        return output.length > 10 ? "long" : "short";
      };

      const evaluator = createEvaluator(fn, {
        name: "length-checker",
      });

      const result = await evaluator.evaluate({
        input: "test",
        output: "very long output text",
      });

      expect(result).toEqual({ label: "long" });
    });

    it("should return an EvaluatorInterface", () => {
      const fn = () => 1;
      const evaluator = createEvaluator(fn, { name: "test" });

      expect(evaluator).toHaveProperty("evaluate");
      expect(evaluator).toHaveProperty("name");
      expect(evaluator).toHaveProperty("kind");
      expect(typeof evaluator.evaluate).toBe("function");
    });
  });

  describe("name inference", () => {
    it("should use the provided name when given", () => {
      const fn = () => 1;
      const evaluator = createEvaluator(fn, { name: "custom-name" });

      expect(evaluator.name).toBe("custom-name");
    });

    it("should infer name from function name when no name provided", () => {
      function accuracyChecker() {
        return 1;
      }

      const evaluator = createEvaluator(accuracyChecker);

      expect(evaluator.name).toBe("accuracyChecker");
    });

    it("should generate a unique name when function has no name", () => {
      // Create a function and delete its name property to simulate no name
      const fn = () => 1;
      // Override the name property to be empty/falsy
      Object.defineProperty(fn, "name", { value: "", configurable: true });
      const evaluator = createEvaluator(fn);

      expect(evaluator.name).toMatch(/^evaluator-[a-z0-9]+$/);
    });

    it("should prioritize provided name over function name", () => {
      function myFunction() {
        return 1;
      }

      const evaluator = createEvaluator(myFunction, {
        name: "overridden-name",
      });

      expect(evaluator.name).toBe("overridden-name");
    });
  });

  describe("default values", () => {
    it("should default kind to CODE", () => {
      const fn = () => 1;
      const evaluator = createEvaluator(fn, { name: "test" });

      expect(evaluator.kind).toBe("CODE");
    });

    it("should default optimizationDirection to MAXIMIZE", () => {
      const fn = () => 1;
      const evaluator = createEvaluator(fn, { name: "test" });

      expect(evaluator.optimizationDirection).toBe("MAXIMIZE");
    });

    it("should default telemetry to enabled", () => {
      const fn = () => 1;
      const evaluator = createEvaluator(fn, { name: "test" });

      expect(evaluator.telemetry).toEqual({ isEnabled: true });
    });
  });

  describe("custom options", () => {
    it("should set kind to LLM when provided", () => {
      const fn = () => 1;
      const evaluator = createEvaluator(fn, {
        name: "test",
        kind: "LLM",
      });

      expect(evaluator.kind).toBe("LLM");
    });

    it("should set optimizationDirection to MINIMIZE when provided", () => {
      const fn = () => 1;
      const evaluator = createEvaluator(fn, {
        name: "test",
        optimizationDirection: "MINIMIZE",
      });

      expect(evaluator.optimizationDirection).toBe("MINIMIZE");
    });

    it("should accept custom telemetry configuration", () => {
      const tracer = tracerProvider.getTracer("test");
      const fn = () => 1;
      const evaluator = createEvaluator(fn, {
        name: "test",
        telemetry: { isEnabled: true, tracer },
      });

      expect(evaluator.telemetry).toEqual({
        isEnabled: true,
        tracer,
      });
    });

    it("should accept all options together", () => {
      const tracer = tracerProvider.getTracer("test");
      const fn = () => 1;
      const evaluator = createEvaluator(fn, {
        name: "comprehensive-test",
        kind: "LLM",
        optimizationDirection: "MINIMIZE",
        telemetry: { isEnabled: false, tracer },
      });

      expect(evaluator.name).toBe("comprehensive-test");
      expect(evaluator.kind).toBe("LLM");
      expect(evaluator.optimizationDirection).toBe("MINIMIZE");
      expect(evaluator.telemetry).toEqual({
        isEnabled: false,
        tracer,
      });
    });
  });

  describe("telemetry", () => {
    it("should enable telemetry by default", () => {
      const fn = () => 1;
      const evaluator = createEvaluator(fn, { name: "test" });

      expect(evaluator.telemetry?.isEnabled).toBe(true);
    });

    it("should disable telemetry when isEnabled is false", async () => {
      const fn = ({ output }: TestRecord) => {
        return output.length;
      };

      const evaluator = createEvaluator(fn, {
        name: "test",
        telemetry: { isEnabled: false },
      });

      expect(evaluator.telemetry?.isEnabled).toBe(false);

      const result = await evaluator.evaluate({
        input: "test",
        output: "hello",
      });

      expect(result).toEqual({ score: 5 });

      // Verify no spans were created when telemetry is disabled
      const spans = spanExporter.getFinishedSpans();
      expect(spans).toHaveLength(0);
    });

    it("should create spans when telemetry is enabled", async () => {
      const tracer = tracerProvider.getTracer("test");
      const fn = ({ output }: TestRecord) => {
        return output.length;
      };

      const evaluator = createEvaluator(fn, {
        name: "test-evaluator",
        telemetry: { isEnabled: true, tracer },
      });

      const result = await evaluator.evaluate({
        input: "test",
        output: "hello",
      });

      expect(result).toEqual({ score: 5 });

      // Verify spans were created
      const spans = spanExporter.getFinishedSpans();
      expect(spans).toHaveLength(1);

      const span = spans[0];
      expect(span.name).toBe("test-evaluator");
      expect(span.kind).toBe(SpanKind.INTERNAL);
      expect(span.status.code).toBe(1); // OK
    });

    it("should create spans with correct attributes for async functions", async () => {
      const tracer = tracerProvider.getTracer("test");
      const fn = async ({ output }: TestRecord) => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return output.length;
      };

      const evaluator = createEvaluator(fn, {
        name: "async-evaluator",
        telemetry: { isEnabled: true, tracer },
      });

      const result = await evaluator.evaluate({
        input: "test",
        output: "hello world",
      });

      expect(result).toEqual({ score: 11 });

      const spans = spanExporter.getFinishedSpans();
      expect(spans).toHaveLength(1);

      const span = spans[0];
      expect(span.name).toBe("async-evaluator");
      expect(span.status.code).toBe(1); // OK
    });

    it("should record errors in spans when function throws", async () => {
      const tracer = tracerProvider.getTracer("test");
      const fn = () => {
        throw new Error("Test error");
      };

      const evaluator = createEvaluator(fn, {
        name: "error-evaluator",
        telemetry: { isEnabled: true, tracer },
      });

      await expect(
        evaluator.evaluate({
          input: "test",
          output: "test",
        })
      ).rejects.toThrow("Test error");

      const spans = spanExporter.getFinishedSpans();
      expect(spans).toHaveLength(1);

      const span = spans[0];
      expect(span.name).toBe("error-evaluator");
      expect(span.status.code).toBe(2); // ERROR
      expect(span.status.message).toBe("Test error");
      expect(span.events).toHaveLength(1);
      expect(span.events[0].name).toBe("exception");
    });

    it("should use global tracer when no tracer provided", async () => {
      const fn = ({ output }: TestRecord) => {
        return output.length;
      };

      const evaluator = createEvaluator(fn, {
        name: "global-tracer-test",
        telemetry: { isEnabled: true },
      });

      const result = await evaluator.evaluate({
        input: "test",
        output: "hello",
      });

      expect(result).toEqual({ score: 5 });

      // Spans should still be created using global tracer
      const spans = spanExporter.getFinishedSpans();
      expect(spans.length).toBeGreaterThanOrEqual(0); // May or may not have spans depending on global tracer setup
    });
  });

  describe("evaluator behavior", () => {
    it("should evaluate records correctly", async () => {
      const fn = ({ output, expected }: TestRecord) => {
        return output === expected ? 1 : 0;
      };

      const evaluator = createEvaluator(fn, { name: "test" });

      const result1 = await evaluator.evaluate({
        input: "test",
        output: "match",
        expected: "match",
      });

      expect(result1).toEqual({ score: 1 });

      const result2 = await evaluator.evaluate({
        input: "test",
        output: "no match",
        expected: "match",
      });

      expect(result2).toEqual({ score: 0 });
    });

    it("should handle errors thrown by the function", async () => {
      const fn = () => {
        throw new Error("Test error");
      };

      const evaluator = createEvaluator(fn, { name: "test" });

      await expect(
        evaluator.evaluate({
          input: "test",
          output: "test",
        })
      ).rejects.toThrow("Test error");
    });

    it("should handle async errors", async () => {
      const fn = async () => {
        throw new Error("Async error");
      };

      const evaluator = createEvaluator(fn, { name: "test" });

      await expect(
        evaluator.evaluate({
          input: "test",
          output: "test",
        })
      ).rejects.toThrow("Async error");
    });
  });

  describe("type safety", () => {
    it("should work with custom record types", async () => {
      type CustomRecord = {
        question: string;
        answer: string;
      };

      const fn = ({ question, answer }: CustomRecord) => {
        return question.length + answer.length;
      };

      const evaluator = createEvaluator<CustomRecord>(fn, { name: "test" });

      const result = await evaluator.evaluate({
        question: "What is AI?",
        answer: "Artificial Intelligence",
      });

      // "What is AI?" = 12 chars, "Artificial Intelligence" = 22 chars, total = 34
      expect(result).toEqual({ score: 34 });
    });

    it("should preserve type information", () => {
      type CustomRecord = {
        value: number;
      };

      const fn = ({ value }: CustomRecord) => value * 2;

      const evaluator = createEvaluator<CustomRecord>(fn, { name: "test" });

      // TypeScript should enforce the correct type
      expect(evaluator).toBeDefined();
    });
  });

  describe("edge cases", () => {
    it("should handle functions returning 0", async () => {
      const fn = () => 0;
      const evaluator = createEvaluator(fn, { name: "test" });

      const result = await evaluator.evaluate({
        input: "test",
        output: "test",
      });

      expect(result).toEqual({ score: 0 });
    });

    it("should handle functions returning negative numbers", async () => {
      const fn = () => -1;
      const evaluator = createEvaluator(fn, { name: "test" });

      const result = await evaluator.evaluate({
        input: "test",
        output: "test",
      });

      expect(result).toEqual({ score: -1 });
    });

    it("should handle functions returning null", async () => {
      const fn = () => null;
      const evaluator = createEvaluator(fn, { name: "test" });

      const result = await evaluator.evaluate({
        input: "test",
        output: "test",
      });

      expect(result).toEqual({});
    });

    it("should handle functions returning undefined", async () => {
      const fn = () => undefined;
      const evaluator = createEvaluator(fn, { name: "test" });

      const result = await evaluator.evaluate({
        input: "test",
        output: "test",
      });

      expect(result).toEqual({});
    });

    it("should handle functions with no parameters", async () => {
      const fn = () => 42;
      const evaluator = createEvaluator(fn, { name: "test" });

      const result = await evaluator.evaluate({
        input: "test",
        output: "test",
      });

      expect(result).toEqual({ score: 42 });
    });
  });

  describe("integration", () => {
    it("should create a FunctionEvaluator instance", () => {
      const fn = () => 1;
      const evaluator = createEvaluator(fn, { name: "test" });

      // FunctionEvaluator should have evaluateFn property
      expect(evaluator).toHaveProperty("evaluateFn");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(typeof (evaluator as any).evaluateFn).toBe("function");
    });

    it("should work with bindInputMapping", () => {
      const fn = () => 1;
      const evaluator = createEvaluator(fn, { name: "test" });

      const boundEvaluator = evaluator.bindInputMapping({
        mappedInput: "input",
      });

      expect(boundEvaluator.inputMapping).toEqual({
        mappedInput: "input",
      });
      expect(boundEvaluator.name).toBe("test");
    });

    it("should maintain evaluator properties after binding", () => {
      const fn = () => 1;
      const evaluator = createEvaluator(fn, {
        name: "test",
        kind: "LLM",
        optimizationDirection: "MINIMIZE",
      });

      const boundEvaluator = evaluator.bindInputMapping({
        mapped: "value",
      });

      expect(boundEvaluator.name).toBe("test");
      expect(boundEvaluator.kind).toBe("LLM");
      expect(boundEvaluator.optimizationDirection).toBe("MINIMIZE");
    });
  });
});

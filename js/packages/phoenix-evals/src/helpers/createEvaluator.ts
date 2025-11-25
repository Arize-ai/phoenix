import { withSpan } from "@arizeai/openinference-core";

import { EvaluatorBase } from "../core/EvaluatorBase";
import { FunctionEvaluator } from "../core/FunctionEvaluator";
import {
  EvaluationKind,
  OptimizationDirection,
  TelemetryConfig,
} from "../types";

import { asEvaluatorFn } from "./asEvaluatorFn";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFn = (...args: any[]) => any;

function generateUniqueName(): string {
  return `evaluator-${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Options for creating a custom evaluator using {@link CreateEvaluator}.
 *
 * @public
 */
export type CreateEvaluatorOptions = {
  /**
   * The name of the evaluator / metric that it measures.
   *
   * If not provided, the function will attempt to infer the name from the function's `name` property.
   * If the function has no name, a unique name will be generated.
   *
   * @example
   * ```typescript
   * const evaluator = CreateEvaluator(myFunction, { name: "custom-metric" });
   * ```
   */
  name?: string;
  /**
   * The kind of the evaluation.
   *
   * - `"CODE"`: Code-based evaluator that runs custom logic
   * - `"LLM"`: LLM-based evaluator that uses a language model
   *
   * @defaultValue `"CODE"`
   *
   * @example
   * ```typescript
   * const evaluator = CreateEvaluator(myFunction, { kind: "CODE" });
   * ```
   */
  kind?: EvaluationKind;
  /**
   * The direction to optimize the numeric evaluation score.
   *
   * - `"MAXIMIZE"`: Higher scores are better (e.g., accuracy, F1 score)
   * - `"MINIMIZE"`: Lower scores are better (e.g., error rate, latency)
   *
   * @defaultValue `"MAXIMIZE"`
   *
   * @example
   * ```typescript
   * const evaluator = CreateEvaluator(myFunction, {
   *   optimizationDirection: "MAXIMIZE"
   * });
   * ```
   */
  optimizationDirection?: OptimizationDirection;
  /**
   * The telemetry configuration for the evaluator.
   *
   * When enabled, the evaluator will automatically create OpenTelemetry spans
   * for tracing and observability. This allows you to track evaluator performance
   * and debug issues in distributed systems.
   *
   * @defaultValue `{ isEnabled: true }`
   *
   * @example
   * ```typescript
   * const evaluator = CreateEvaluator(myFunction, {
   *   telemetry: { isEnabled: true, tracer: myTracer }
   * });
   * ```
   */
  telemetry?: TelemetryConfig;
};

/**
 * A factory function for creating a custom evaluator from any function.
 *
 * This function wraps a user-provided function into an evaluator that can be used
 * with Phoenix experiments and evaluations. The function can be synchronous or
 * asynchronous, and can return a number, an {@link EvaluationResult} object, or
 * a value that will be automatically converted to an evaluation result.
 *
 * The evaluator will automatically:
 * - Convert the function's return value to an {@link EvaluationResult}
 * - Handle both sync and async functions
 * - Wrap the function with OpenTelemetry spans if telemetry is enabled
 * - Infer the evaluator name from the function name if not provided
 *
 * @typeParam RecordType - The type of the input record that the evaluator expects.
 *   Must extend `Record<string, unknown>`.
 * @typeParam Fn - The type of the function being wrapped. Must be a function that
 *   accepts the record type and returns a value compatible with {@link EvaluationResult}.
 *
 * @param fn - The function to wrap as an evaluator. Can be synchronous or asynchronous.
 *   The function should accept a record of type `RecordType` and return either:
 *   - A number (will be converted to `{ score: number }`)
 *   - An {@link EvaluationResult} object
 *   - Any value that can be converted to an evaluation result
 *
 * @param options - Optional configuration for the evaluator. See {@link CreateEvaluatorOptions}
 *   for details on available options.
 *
 * @returns An {@link EvaluatorInterface} that can be used with Phoenix experiments
 *   and evaluation workflows.
 *
 * @example
 * Basic usage with a simple scoring function:
 * ```typescript
 * const accuracyEvaluator = CreateEvaluator(
 *   ({ output, expected }) => {
 *     return output === expected ? 1 : 0;
 *   },
 *   {
 *     name: "accuracy",
 *     kind: "CODE",
 *     optimizationDirection: "MAXIMIZE"
 *   }
 * );
 *
 * const result = await accuracyEvaluator.evaluate({
 *   output: "correct answer",
 *   expected: "correct answer"
 * });
 * // result: { score: 1 }
 * ```
 *
 *
 * @example
 * Returning a full EvaluationResult:
 * ```typescript
 * const qualityEvaluator = CreateEvaluator(
 *   ({ output }) => {
 *     const score = calculateQuality(output);
 *     return {
 *       score,
 *       label: score > 0.8 ? "high" : "low",
 *       explanation: `Quality score: ${score}`
 *     };
 *   },
 *   { name: "quality" }
 * );
 * ```
 */
export function createEvaluator<
  RecordType extends Record<string, unknown> = Record<string, unknown>,
  Fn extends AnyFn = AnyFn,
>(fn: Fn, options?: CreateEvaluatorOptions): EvaluatorBase<RecordType> {
  const {
    name,
    kind,
    optimizationDirection,
    telemetry = { isEnabled: true },
  } = options || {};
  const evaluatorName = name || fn.name || generateUniqueName();
  let evaluateFn = asEvaluatorFn<RecordType>(fn);

  // Add OpenTelemetry span wrapping if telemetry is enabled
  if (telemetry && telemetry.isEnabled) {
    evaluateFn = withSpan(evaluateFn, {
      tracer: telemetry.tracer,
      name: evaluatorName,
      kind: "EVALUATOR",
    });
  }
  return new FunctionEvaluator<RecordType>({
    evaluateFn,
    name: evaluatorName,
    kind: kind || "CODE",
    optimizationDirection: optimizationDirection || "MAXIMIZE",
    telemetry,
  });
}

import { FunctionEvaluator } from "../core/FunctionEvaluator";
import {
  EvaluationKind,
  EvaluatorInterface,
  OptimizationDirection,
  TelemetryConfig,
} from "../types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFn = (...args: any[]) => any;

function generateUniqueName(): string {
  return `evaluator-${Math.random().toString(36).substring(2, 15)}`;
}
export type CreateEvaluatorOptions = {
  /**
   * The name of the evaluator / metric that it measures
   * Defaults to trying to infer the name of the function
   */
  name?: string;
  /**
   * The description of the evaluator
   * Defaults to the name of the function
   */
  description?: string;
  /**
   * The kind of the evaluation
   * Defaults to CODE
   */
  kind?: EvaluationKind;
  /**
   * The direction to optimize the numeric evaluation score
   * Defaults to MAXIMIZE
   */
  optimizationDirection?: OptimizationDirection;
  /**
   * The telemetry configuration for the evaluator
   * Defaults to enabled
   */
  telemetry?: TelemetryConfig;
};
/**
 * A factory function for creating an evaluator.
 */
export function CreateEvaluator<
  RecordType extends Record<string, unknown> = Record<string, unknown>,
  Fn extends AnyFn = AnyFn,
>(
  evaluateFn: Fn,
  options?: CreateEvaluatorOptions
): EvaluatorInterface<RecordType> {
  const { name, kind, optimizationDirection, telemetry } = options || {};
  const evaluatorName = name || evaluateFn.name || generateUniqueName();
  return new FunctionEvaluator<RecordType>({
    evaluateFn,
    name: evaluatorName,
    kind: kind || "CODE",
    optimizationDirection: optimizationDirection || "MAXIMIZE",
    telemetry: telemetry || { isEnabled: true },
  });
}

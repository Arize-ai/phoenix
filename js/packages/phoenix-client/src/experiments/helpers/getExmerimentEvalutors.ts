import type { ClassificationEvaluator } from "@arizeai/phoenix-evals";

import { Evaluator } from "../../types/experiments";

import { fromPhoenixEvaluator } from "./fromPhoenixEvaluator";

/**
 * A type guard for ClassificationEvaluator functions.
 * Note: this is not fool proof, and may need to be updated as phoenix-evals evolves.
 */
function isClassificationEvaluator(
  evaluator: unknown
): evaluator is ClassificationEvaluator<Record<string, unknown>> {
  return (
    typeof evaluator === "object" &&
    evaluator !== null &&
    "evaluate" in evaluator &&
    typeof evaluator.evaluate === "function" &&
    "name" in evaluator &&
    typeof evaluator.name === "string" &&
    "kind" in evaluator &&
    typeof evaluator.kind === "string" &&
    evaluator.kind === "LLM"
  );
}

/**
 * A type guard for Evaluator objects.
 * Note: this is not fool proof, and may need to be updated as the package evolves
 */
function isExperimentEvaluator(evaluator: unknown): evaluator is Evaluator {
  return (
    typeof evaluator === "object" &&
    evaluator !== null &&
    "evaluate" in evaluator &&
    typeof evaluator.evaluate === "function" &&
    "name" in evaluator &&
    typeof evaluator.name === "string" &&
    "kind" in evaluator &&
    typeof evaluator.kind === "string"
  );
}

/**
 * A function that normalizes evaluators to be runnable by experiments. This is a best effort to support a variety of evaluator types.
 */
export function getExperimentEvaluators(evaluators: unknown[]): Evaluator[] {
  return evaluators.map((evaluator) => {
    if (isClassificationEvaluator(evaluator)) {
      return fromPhoenixEvaluator(evaluator);
    }
    if (isExperimentEvaluator(evaluator)) {
      return evaluator;
    }
    throw new Error(`Unsupported evaluator: ${JSON.stringify(evaluator)}`);
  });
}

import type { LLMEvaluator } from "@arizeai/phoenix-evals";

import { Evaluator } from "../../types/experiments";

import { fromPhoenixLLMEvaluator } from "./fromPhoenixLLMEvaluator";

/**
 * A type guard for LLMEvaluator classes.
 * Note: this is not fool proof, and may need to be updated as phoenix-evals evolves.
 */
function isPhoenixLLMEvaluator(
  evaluator: unknown
): evaluator is LLMEvaluator<Record<string, unknown>> {
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
    typeof evaluator.kind === "string" &&
    (evaluator.kind === "CODE" || evaluator.kind === "LLM")
  );
}

/**
 * A function that normalizes evaluators to be runnable by experiments. This is a best effort to support a variety of evaluator types.
 */
export function getExperimentEvaluators(evaluators: unknown[]): Evaluator[] {
  return evaluators.map((evaluator) => {
    if (isExperimentEvaluator(evaluator)) {
      return evaluator;
    }
    if (isPhoenixLLMEvaluator(evaluator)) {
      return fromPhoenixLLMEvaluator(evaluator);
    }
    throw new Error(`Unsupported evaluator: ${JSON.stringify(evaluator)}`);
  });
}

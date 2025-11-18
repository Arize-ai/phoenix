import { AnnotatorKind } from "../../types/annotations";
import { Evaluator } from "../../types/experiments";

/**
 * Wrap an evaluator function in an object with a name property.
 *
 * @experimental This feature is not complete, and will change in the future.
 *
 * @param params - The parameters for creating the evaluator
 * @param params.name - The name of the evaluator.
 * @param params.kind - The kind of evaluator (e.g., "CODE", "LLM")
 * @param params.evaluate - The evaluator function.
 * @returns The evaluator object.
 */
export function asExperimentEvaluator({
  name,
  kind,
  evaluate,
}: {
  name: string;
  kind: AnnotatorKind;
  evaluate: Evaluator["evaluate"];
}): Evaluator {
  return {
    name,
    kind,
    evaluate,
  };
}

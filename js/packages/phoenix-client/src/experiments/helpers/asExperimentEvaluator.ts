import { AnnotatorKind } from "../../types/annotations";
import { Example } from "../../types/datasets";
import { ExperimentEvaluator, TaskOutput } from "../../types/experiments";

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
export function asExperimentEvaluator<
  TaskOutputType = TaskOutput,
  InputType extends Example["input"] = Example["input"],
  ExpectedType extends Example["output"] = Example["output"],
>({
  name,
  kind,
  evaluate,
}: {
  name: string;
  kind: AnnotatorKind;
  evaluate: ExperimentEvaluator<TaskOutputType>["evaluate"];
}): ExperimentEvaluator<TaskOutputType, InputType, ExpectedType> {
  return {
    name,
    kind,
    evaluate,
  };
}

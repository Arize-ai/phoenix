import { CreateClassificationEvaluatorArgs } from "../types/evals";
import { ClassificationEvaluator } from "./ClassificationEvaluator";

export function createClassificationEvaluator<
  ExampleType extends Record<string, unknown>,
>(
  args: CreateClassificationEvaluatorArgs
): ClassificationEvaluator<ExampleType> {
  return new ClassificationEvaluator<ExampleType>(args);
}

import { CreateClassificationEvaluatorArgs, Evaluator } from "../types/evals";
import { ClassificationEvaluator } from "./ClassificationEvaluator";

export function createClassificationEvaluator<
  ExampleType extends Record<string, unknown>,
>(args: CreateClassificationEvaluatorArgs): Evaluator<ExampleType> {
  return new ClassificationEvaluator<ExampleType>(args);
}

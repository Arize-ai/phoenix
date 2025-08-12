import { CreateClassificationEvaluatorArgs, Evaluator } from "../types/evals";
import { createClassifierFn } from "./createClassifierFn";

export function createClassificationEvaluator<
  ExampleType extends Record<string, unknown>,
>(args: CreateClassificationEvaluatorArgs): Evaluator<ExampleType> {
  return {
    name: args.name,
    source: "LLM",
    optimizationDirection: args.optimizationDirection,
    evaluate: createClassifierFn(args),
  };
}

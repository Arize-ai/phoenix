import { CreateClassificationEvaluatorArgs, EvaluatorFn } from "../types/evals";
import { createClassifierFn } from "./createClassifierFn";
import { LLMEvaluator } from "./LLMEvaluator";

/**
 * An LLM evaluator that performs evaluation via classification
 */
export class ClassificationEvaluator<
  ExampleType extends Record<string, unknown>,
> extends LLMEvaluator<ExampleType> {
  readonly evaluatorFn: EvaluatorFn<ExampleType>;
  constructor(args: CreateClassificationEvaluatorArgs) {
    const { name } = args;
    super({ name });
    this.evaluatorFn = createClassifierFn<ExampleType>(args);
  }
  evaluate = (example: ExampleType) => {
    return this.evaluatorFn(example);
  };
}

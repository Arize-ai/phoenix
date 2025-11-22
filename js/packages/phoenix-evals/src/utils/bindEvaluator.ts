import { EvaluatorBase } from "../core/EvaluatorBase";
import { ObjectMapping } from "../types/data";

export type BindingContext<RecordType extends Record<string, unknown>> = {
  inputMapping: ObjectMapping<RecordType>;
};
/**
 * A utility function that binds an evaluator to a specific context.
 * @param evaluator The evaluator to bind the input mapping to
 * @param context The context to bind the input mapping to
 * @returns A new evaluator instance with the input mapping bound
 */
export function bindEvaluator<RecordType extends Record<string, unknown>>(
  evaluator: EvaluatorBase<RecordType>,
  context: BindingContext<RecordType>
): EvaluatorBase<RecordType> {
  let boundEvaluator: EvaluatorBase<RecordType> = evaluator;
  if (context.inputMapping) {
    boundEvaluator = boundEvaluator.bindInputMapping(context.inputMapping);
  }
  return boundEvaluator;
}

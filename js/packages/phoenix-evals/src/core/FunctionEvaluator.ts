import { CreateEvaluatorArgs, EvaluationResult, ObjectMapping } from "../types";

import { EvaluatorBase } from "./EvaluatorBase";

type FunctionEvaluatorArgs<RecordType extends Record<string, unknown>> =
  CreateEvaluatorArgs<RecordType> & {
    evaluateFn: (args: RecordType) => Promise<EvaluationResult>;
  };
/**
 * A class that constructs an evaluator based on an evaluate function.
 */
export class FunctionEvaluator<
  RecordType extends Record<string, unknown>,
> extends EvaluatorBase<RecordType> {
  readonly evaluateFn: (args: RecordType) => Promise<EvaluationResult>;
  constructor({ evaluateFn, ...args }: FunctionEvaluatorArgs<RecordType>) {
    super({ ...args });
    this.evaluateFn = evaluateFn;
  }
  async evaluate(args: RecordType): Promise<EvaluationResult> {
    return this.evaluateFn(args);
  }
  bindInputMapping(
    inputMapping: ObjectMapping<RecordType>
  ): FunctionEvaluator<RecordType> {
    return new FunctionEvaluator({ ...this, inputMapping });
  }
}

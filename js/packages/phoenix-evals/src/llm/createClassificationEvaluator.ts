import { CreateClassificationEvaluatorArgs } from "../types/evals";

import { ClassificationEvaluator } from "./ClassificationEvaluator";

export function createClassificationEvaluator<
  RecordType extends Record<string, unknown>,
>(
  args: CreateClassificationEvaluatorArgs<RecordType>
): ClassificationEvaluator<RecordType> {
  return new ClassificationEvaluator<RecordType>(args);
}

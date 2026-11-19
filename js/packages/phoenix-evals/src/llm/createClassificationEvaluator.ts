import type {
  ClassificationChoices,
  ClassificationChoicesMap,
  CreateClassificationEvaluatorArgs,
} from "../types/evals";
import { ClassificationEvaluator } from "./ClassificationEvaluator";

export function createClassificationEvaluator<
  RecordType extends Record<string, unknown>,
  ChoicesType extends ClassificationChoices = ClassificationChoicesMap,
>(
  args: CreateClassificationEvaluatorArgs<RecordType>
): ClassificationEvaluator<RecordType, ChoicesType> {
  return new ClassificationEvaluator<RecordType, ChoicesType>(args);
}

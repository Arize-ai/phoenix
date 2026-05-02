import type { CreatePairwiseEvaluatorArgs } from "../types/evals";
import { PairwiseEvaluator } from "./PairwiseEvaluator";

export function createPairwiseEvaluator<
  RecordType extends Record<string, unknown>,
>(
  args: CreatePairwiseEvaluatorArgs<RecordType>
): PairwiseEvaluator<RecordType> {
  return new PairwiseEvaluator<RecordType>(args);
}

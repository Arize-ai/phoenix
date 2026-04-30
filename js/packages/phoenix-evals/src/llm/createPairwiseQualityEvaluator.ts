import { PAIRWISE_QUALITY_EVALUATOR_CONFIG } from "../__generated__/default_templates";
import type { CreatePairwiseEvaluatorArgs } from "../types/evals";
import { PairwiseEvaluator } from "./PairwiseEvaluator";

export type PairwiseQualityEvaluationRecord = {
  input: string;
  a: unknown;
  b: unknown;
};

export interface PairwiseQualityEvaluatorArgs<
  RecordType extends Record<string, unknown> = PairwiseQualityEvaluationRecord,
> extends Omit<
  CreatePairwiseEvaluatorArgs<RecordType>,
  "promptTemplate" | "optimizationDirection" | "name"
> {
  optimizationDirection?: CreatePairwiseEvaluatorArgs<RecordType>["optimizationDirection"];
  name?: CreatePairwiseEvaluatorArgs<RecordType>["name"];
  promptTemplate?: CreatePairwiseEvaluatorArgs<RecordType>["promptTemplate"];
}

export function createPairwiseQualityEvaluator<
  RecordType extends Record<string, unknown> = PairwiseQualityEvaluationRecord,
>(args: PairwiseQualityEvaluatorArgs<RecordType>): PairwiseEvaluator<RecordType> {
  const {
    promptTemplate = PAIRWISE_QUALITY_EVALUATOR_CONFIG.template,
    optimizationDirection = PAIRWISE_QUALITY_EVALUATOR_CONFIG.optimizationDirection,
    name = PAIRWISE_QUALITY_EVALUATOR_CONFIG.name,
    ...rest
  } = args;
  return new PairwiseEvaluator<RecordType>({
    ...rest,
    promptTemplate,
    optimizationDirection,
    name,
  });
}

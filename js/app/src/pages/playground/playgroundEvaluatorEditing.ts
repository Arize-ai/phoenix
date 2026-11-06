import type { EvaluatorKind } from "@phoenix/types";

export type EditingEvaluator = {
  datasetEvaluatorId: string;
  kind: EvaluatorKind;
  isBuiltIn: boolean;
};

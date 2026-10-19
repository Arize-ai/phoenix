import type { AnnotationConfig } from "@phoenix/components/annotation";
import type { EvaluatorKind } from "@phoenix/types";
import type {
  DatasetEvaluatorForConfig,
  DatasetEvaluatorOutputConfig,
} from "@phoenix/utils/datasetEvaluatorUtils";
import { datasetEvaluatorsToAnnotationConfigs } from "@phoenix/utils/datasetEvaluatorUtils";

type PlaygroundDatasetEvaluatorForConfig = DatasetEvaluatorForConfig & {
  readonly kind?: EvaluatorKind;
};

/**
 * A decision binding's results are stored under the server's
 * `result_annotation_names`: one question writes under the binding's name,
 * several under `{binding}.{question}`. Its output configs are named after the
 * questions, so the names are rewritten here to match the stored annotations.
 */
function toDecisionAnnotationConfigs(
  evaluator: PlaygroundDatasetEvaluatorForConfig
): AnnotationConfig[] {
  const outputConfigs: readonly DatasetEvaluatorOutputConfig[] =
    evaluator.outputConfigs ?? [];
  const renamed = outputConfigs.map((config) => ({
    ...config,
    name:
      outputConfigs.length > 1
        ? `${evaluator.name}.${config.name ?? ""}`
        : evaluator.name,
  }));
  return datasetEvaluatorsToAnnotationConfigs([
    { name: evaluator.name, outputConfigs: renamed },
  ]);
}

/** The annotation columns the selected dataset evaluators produce. */
export function getDatasetEvaluatorAnnotationConfigs(
  evaluators: readonly PlaygroundDatasetEvaluatorForConfig[]
): AnnotationConfig[] {
  return evaluators.flatMap((evaluator) =>
    evaluator.kind === "DECISION"
      ? toDecisionAnnotationConfigs(evaluator)
      : datasetEvaluatorsToAnnotationConfigs([evaluator])
  );
}

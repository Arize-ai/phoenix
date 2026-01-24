import type { AnnotationConfig } from "@phoenix/components/annotation";

/**
 * The shape of a dataset evaluator's output config from GraphQL.
 * This is the union of CategoricalAnnotationConfig and ContinuousAnnotationConfig.
 */
export type DatasetEvaluatorOutputConfig = {
  readonly name?: string;
  readonly optimizationDirection?: string;
  readonly values?: readonly {
    readonly label: string;
    readonly score: number | null;
  }[];
  readonly lowerBound?: number | null;
  readonly upperBound?: number | null;
} | null;

/**
 * The minimal shape of a dataset evaluator needed for conversion.
 */
export type DatasetEvaluatorForConfig = {
  readonly name: string;
  readonly outputConfig?: DatasetEvaluatorOutputConfig;
};

/**
 * Converts a single dataset evaluator to an AnnotationConfig.
 * Handles CategoricalAnnotationConfig, ContinuousAnnotationConfig, and falls back to FREEFORM.
 */
export function datasetEvaluatorToAnnotationConfig(
  evaluator: DatasetEvaluatorForConfig
): AnnotationConfig {
  const outputConfig = evaluator.outputConfig;

  if (!outputConfig) {
    // TODO: all evaluators should have an output config eventually
    return {
      name: evaluator.name,
      annotationType: "FREEFORM",
    };
  }

  // Handle CategoricalAnnotationConfig from the union
  if ("values" in outputConfig && outputConfig.values) {
    return {
      name: outputConfig.name ?? evaluator.name,
      optimizationDirection: outputConfig.optimizationDirection as
        | "MAXIMIZE"
        | "MINIMIZE"
        | "NONE"
        | undefined,
      values: outputConfig.values,
      annotationType: "CATEGORICAL",
    };
  }

  // Handle ContinuousAnnotationConfig from the union
  if ("lowerBound" in outputConfig || "upperBound" in outputConfig) {
    return {
      name: outputConfig.name ?? evaluator.name,
      optimizationDirection: outputConfig.optimizationDirection as
        | "MAXIMIZE"
        | "MINIMIZE"
        | "NONE"
        | undefined,
      lowerBound: outputConfig.lowerBound,
      upperBound: outputConfig.upperBound,
      annotationType: "CONTINUOUS",
    };
  }

  // Fallback for freeform or unknown types
  return {
    name: evaluator.name,
    annotationType: "FREEFORM",
  };
}

/**
 * Converts an array of dataset evaluators to an array of AnnotationConfigs.
 */
export function datasetEvaluatorsToAnnotationConfigs(
  evaluators: readonly DatasetEvaluatorForConfig[]
): AnnotationConfig[] {
  return evaluators.map(datasetEvaluatorToAnnotationConfig);
}

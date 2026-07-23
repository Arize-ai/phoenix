import type { AnnotationConfig } from "@phoenix/components/annotation";

/**
 * The shape of a dataset evaluator's output config from GraphQL.
 * This is the union of CategoricalAnnotationConfig, ContinuousAnnotationConfig, and FreeformAnnotationConfig.
 */
export type DatasetEvaluatorOutputConfig = {
  readonly __typename?: string;
  readonly name?: string;
  readonly optimizationDirection?: string;
  readonly values?: readonly {
    readonly label: string;
    readonly score: number | null;
  }[];
  readonly lowerBound?: number | null;
  readonly upperBound?: number | null;
  readonly threshold?: number | null;
};

/**
 * The minimal shape of a dataset evaluator needed for conversion.
 * Uses the outputConfigs array for multi-output evaluator support.
 */
export type DatasetEvaluatorForConfig = {
  readonly name: string;
  /** Array of output configurations for multi-output evaluators */
  readonly outputConfigs?: readonly DatasetEvaluatorOutputConfig[] | null;
};

/**
 * Type guard for the known optimization direction enum values.
 */
function isOptimizationDirection(
  value: string | undefined
): value is "MAXIMIZE" | "MINIMIZE" | "NONE" {
  return value === "MAXIMIZE" || value === "MINIMIZE" || value === "NONE";
}

/**
 * Converts a single output config to an AnnotationConfig.
 */
function outputConfigToAnnotationConfig(
  outputConfig: DatasetEvaluatorOutputConfig,
  fallbackName: string
): AnnotationConfig {
  const optimizationDirection = isOptimizationDirection(
    outputConfig.optimizationDirection
  )
    ? outputConfig.optimizationDirection
    : undefined;

  switch (outputConfig.__typename) {
    case "CategoricalAnnotationConfig":
      return {
        name: outputConfig.name ?? fallbackName,
        optimizationDirection,
        values: outputConfig.values ?? [],
        annotationType: "CATEGORICAL",
      };
    case "ContinuousAnnotationConfig":
      return {
        name: outputConfig.name ?? fallbackName,
        optimizationDirection,
        lowerBound: outputConfig.lowerBound,
        upperBound: outputConfig.upperBound,
        annotationType: "CONTINUOUS",
      };
    case "FreeformAnnotationConfig":
      return {
        name: outputConfig.name ?? fallbackName,
        annotationType: "FREEFORM",
        optimizationDirection,
        threshold: outputConfig.threshold ?? null,
        lowerBound: outputConfig.lowerBound ?? null,
        upperBound: outputConfig.upperBound ?? null,
      };
    default:
      return {
        name: outputConfig.name ?? fallbackName,
        annotationType: "FREEFORM",
        optimizationDirection,
        threshold: outputConfig.threshold ?? null,
        lowerBound: outputConfig.lowerBound ?? null,
        upperBound: outputConfig.upperBound ?? null,
      };
  }
}

/**
 * Converts a single dataset evaluator to an array of AnnotationConfigs.
 * Handles the outputConfigs array for multi-output evaluator support.
 */
export function datasetEvaluatorToAnnotationConfigs(
  evaluator: DatasetEvaluatorForConfig
): AnnotationConfig[] {
  if (evaluator.outputConfigs && evaluator.outputConfigs.length > 0) {
    return evaluator.outputConfigs.map((config) =>
      outputConfigToAnnotationConfig(config, evaluator.name)
    );
  }

  // No configs at all, return FREEFORM
  return [
    {
      name: evaluator.name,
      annotationType: "FREEFORM",
    },
  ];
}

/**
 * Converts an array of dataset evaluators to an array of AnnotationConfigs.
 * Each evaluator can produce multiple configs (for multi-output evaluators).
 */
export function datasetEvaluatorsToAnnotationConfigs(
  evaluators: readonly DatasetEvaluatorForConfig[]
): AnnotationConfig[] {
  return evaluators.flatMap(datasetEvaluatorToAnnotationConfigs);
}

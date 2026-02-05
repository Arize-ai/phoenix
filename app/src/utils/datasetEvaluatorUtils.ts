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
 * Supports both the deprecated outputConfig and the new outputConfigs array.
 */
export type DatasetEvaluatorForConfig = {
  readonly name: string;
  /** @deprecated Use outputConfigs instead */
  readonly outputConfig?: DatasetEvaluatorOutputConfig;
  /** Array of output configurations for multi-output evaluators */
  readonly outputConfigs?:
    | readonly (DatasetEvaluatorOutputConfig | null)[]
    | null;
};

/**
 * Converts a single output config to an AnnotationConfig.
 * @internal
 */
function outputConfigToAnnotationConfig(
  outputConfig: NonNullable<DatasetEvaluatorOutputConfig>,
  fallbackName: string
): AnnotationConfig {
  // Handle CategoricalAnnotationConfig from the union
  if ("values" in outputConfig && outputConfig.values) {
    return {
      name: outputConfig.name ?? fallbackName,
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
      name: outputConfig.name ?? fallbackName,
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
    name: outputConfig.name ?? fallbackName,
    annotationType: "FREEFORM",
  };
}

/**
 * Converts a single dataset evaluator to an array of AnnotationConfigs.
 * Handles both the deprecated outputConfig and the new outputConfigs array.
 */
export function datasetEvaluatorToAnnotationConfigs(
  evaluator: DatasetEvaluatorForConfig
): AnnotationConfig[] {
  // Prefer outputConfigs array if available
  if (evaluator.outputConfigs && evaluator.outputConfigs.length > 0) {
    return evaluator.outputConfigs
      .filter(
        (config): config is NonNullable<DatasetEvaluatorOutputConfig> =>
          config != null
      )
      .map((config) => outputConfigToAnnotationConfig(config, evaluator.name));
  }

  // Fall back to deprecated outputConfig
  const outputConfig = evaluator.outputConfig;
  if (!outputConfig) {
    // No configs at all, return FREEFORM
    return [
      {
        name: evaluator.name,
        annotationType: "FREEFORM",
      },
    ];
  }

  return [outputConfigToAnnotationConfig(outputConfig, evaluator.name)];
}

/**
 * Converts a single dataset evaluator to an AnnotationConfig.
 * @deprecated Use datasetEvaluatorToAnnotationConfigs instead for multi-output support.
 * This function only returns the first config for backward compatibility.
 */
export function datasetEvaluatorToAnnotationConfig(
  evaluator: DatasetEvaluatorForConfig
): AnnotationConfig {
  const configs = datasetEvaluatorToAnnotationConfigs(evaluator);
  return configs[0];
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

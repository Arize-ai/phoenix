import type { AnnotationConfig } from "@phoenix/components/annotation";

/**
 * The shape of a dataset evaluator's output config from GraphQL.
 * This is the union of CategoricalAnnotationConfig, ContinuousAnnotationConfig, and FreeformAnnotationConfig.
 */
export type DatasetEvaluatorOutputConfig = {
  readonly __typename: string;
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
  /** The evaluator kind; decision bindings name their annotations differently. */
  readonly kind?: string;
  /** Array of output configurations for multi-output evaluators */
  readonly outputConfigs?: readonly DatasetEvaluatorOutputConfig[] | null;
};

/**
 * Converts a single output config to an AnnotationConfig.
 */
function outputConfigToAnnotationConfig(
  outputConfig: DatasetEvaluatorOutputConfig,
  fallbackName: string
): AnnotationConfig {
  const optimizationDirection = outputConfig.optimizationDirection as
    | "MAXIMIZE"
    | "MINIMIZE"
    | "NONE"
    | undefined;

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
 * The annotation name a decision binding's question is stored under: the
 * binding's name when the judge has one question, otherwise
 * `{binding}.{question}`. Mirrors the server's `result_annotation_names`.
 */
export function getDecisionAnnotationName({
  bindingName,
  questionName,
  questionCount,
}: {
  bindingName: string;
  questionName: string;
  questionCount: number;
}): string {
  return questionCount === 1 ? bindingName : `${bindingName}.${questionName}`;
}

/**
 * Converts a single dataset evaluator to an array of AnnotationConfigs.
 * Handles the outputConfigs array for multi-output evaluator support.
 * A decision binding's output configs are named after its questions, so they
 * are renamed to the annotation names its results are stored under.
 */
export function datasetEvaluatorToAnnotationConfigs(
  evaluator: DatasetEvaluatorForConfig
): AnnotationConfig[] {
  if (
    evaluator.kind === "DECISION" &&
    evaluator.outputConfigs &&
    evaluator.outputConfigs.length > 0
  ) {
    const questionCount = evaluator.outputConfigs.length;
    return evaluator.outputConfigs.map((config) =>
      outputConfigToAnnotationConfig(
        {
          ...config,
          name: getDecisionAnnotationName({
            bindingName: evaluator.name,
            questionName: config.name ?? "",
            questionCount,
          }),
        },
        evaluator.name
      )
    );
  }
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

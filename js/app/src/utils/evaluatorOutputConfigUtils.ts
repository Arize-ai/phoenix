import type { AnnotationConfig } from "@phoenix/store/evaluatorStore";
import type { EvaluatorOptimizationDirection } from "@phoenix/types";

export type EvaluatorOutputConfigType =
  | "CATEGORICAL"
  | "CONTINUOUS"
  | "FREEFORM";

/**
 * Which kind of evaluator output an evaluator-store config is. Continuous and
 * freeform configs share their fields, so the config's `annotationType` tag
 * decides; categorical configs are the ones with values.
 */
export function getEvaluatorOutputConfigType(
  config: AnnotationConfig
): EvaluatorOutputConfigType {
  if ("values" in config) {
    return "CATEGORICAL";
  }
  return config.annotationType;
}

/** An output config as a GraphQL query selects it, told apart by `__typename`. */
export type SelectedOutputConfig = {
  readonly __typename: string;
  readonly name?: string;
  readonly optimizationDirection?: EvaluatorOptimizationDirection | string;
  readonly values?: ReadonlyArray<{
    readonly label: string;
    readonly score?: number | null;
  }>;
  readonly lowerBound?: number | null;
  readonly upperBound?: number | null;
  readonly threshold?: number | null;
};

function toOptimizationDirection(
  direction: string | undefined
): EvaluatorOptimizationDirection {
  return direction === "MAXIMIZE" || direction === "MINIMIZE"
    ? direction
    : "NONE";
}

/**
 * Converts a selected output config into the evaluator store's shape, tagged
 * with its type. Returns null for a type this client does not know.
 */
export function toEvaluatorStoreOutputConfig(
  config: SelectedOutputConfig
): AnnotationConfig | null {
  const name = config.name ?? "";
  const optimizationDirection = toOptimizationDirection(
    config.optimizationDirection
  );
  switch (config.__typename) {
    case "CategoricalAnnotationConfig":
      return {
        name,
        optimizationDirection,
        values: (config.values ?? []).map(({ label, score }) => ({
          label,
          ...(score != null ? { score } : {}),
        })),
      };
    case "ContinuousAnnotationConfig":
      return {
        annotationType: "CONTINUOUS",
        name,
        optimizationDirection,
        lowerBound: config.lowerBound ?? null,
        upperBound: config.upperBound ?? null,
        threshold: config.threshold ?? null,
      };
    case "FreeformAnnotationConfig":
      return {
        annotationType: "FREEFORM",
        name,
        optimizationDirection,
        threshold: config.threshold ?? null,
        lowerBound: config.lowerBound ?? null,
        upperBound: config.upperBound ?? null,
      };
    default:
      return null;
  }
}

/**
 * Why a continuous threshold cannot be saved, or null when it can: it must sit
 * strictly between whichever bounds are set, since at a bound every result
 * would be good, or every one bad. Mirrors the server's validation.
 */
export function getContinuousThresholdError({
  threshold,
  lowerBound,
  upperBound,
}: {
  threshold: number | null | undefined;
  lowerBound: number | null | undefined;
  upperBound: number | null | undefined;
}): string | null {
  if (threshold == null || Number.isNaN(threshold)) {
    return null;
  }
  if (!Number.isFinite(threshold)) {
    return "Threshold must be a finite number";
  }
  if (lowerBound != null && threshold <= lowerBound) {
    return "Threshold must be greater than the lower bound";
  }
  if (upperBound != null && threshold >= upperBound) {
    return "Threshold must be less than the upper bound";
  }
  return null;
}

/** The hint under a continuous threshold field, for the config's direction. */
export function getContinuousThresholdDescription(
  optimizationDirection: string | null | undefined
): string {
  if (optimizationDirection === "MAXIMIZE") {
    return "Good results are at or above this. Must be between the bounds; empty means the midpoint.";
  }
  if (optimizationDirection === "MINIMIZE") {
    return "Good results are below this. Must be between the bounds; empty means the midpoint.";
  }
  return "Where good results turn bad once a direction is set. Must be between the bounds; empty means the midpoint.";
}

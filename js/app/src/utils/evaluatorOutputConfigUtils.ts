import type { AnnotationConfig } from "@phoenix/store/evaluatorStore";

export type EvaluatorOutputConfigType =
  | "CATEGORICAL"
  | "CONTINUOUS"
  | "FREEFORM";

const OUTPUT_CONFIG_TYPE_BY_TYPENAME: Record<
  string,
  EvaluatorOutputConfigType | undefined
> = {
  CategoricalAnnotationConfig: "CATEGORICAL",
  ContinuousAnnotationConfig: "CONTINUOUS",
  FreeformAnnotationConfig: "FREEFORM",
};

/**
 * Which kind of evaluator output an evaluator-store config is.
 *
 * Continuous and freeform configs share their fields (both may carry bounds and
 * a threshold), so a config's `annotationType` tag, or the GraphQL
 * `__typename` of one copied straight from a query, decides. An untagged
 * config is freeform only when it has a threshold, as before continuous
 * configs could carry one.
 */
export function getEvaluatorOutputConfigType(
  config: AnnotationConfig
): EvaluatorOutputConfigType {
  if ("values" in config) {
    return "CATEGORICAL";
  }
  const tagged = config as { annotationType?: unknown; __typename?: unknown };
  if (
    tagged.annotationType === "CONTINUOUS" ||
    tagged.annotationType === "FREEFORM"
  ) {
    return tagged.annotationType;
  }
  const fromTypename =
    typeof tagged.__typename === "string"
      ? OUTPUT_CONFIG_TYPE_BY_TYPENAME[tagged.__typename]
      : undefined;
  if (fromTypename === "CONTINUOUS" || fromTypename === "FREEFORM") {
    return fromTypename;
  }
  return "threshold" in config ? "FREEFORM" : "CONTINUOUS";
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

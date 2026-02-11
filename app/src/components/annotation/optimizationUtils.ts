import type { AnnotationConfig } from "./types";

type OptimizationDirectionResult = "MAXIMIZE" | "MINIMIZE" | undefined;

/**
 * Normalizes the optimization direction, treating "NONE" as undefined.
 */
function normalizeOptimizationDirection(
  direction: string | null | undefined
): OptimizationDirectionResult {
  if (direction === "MAXIMIZE" || direction === "MINIMIZE") {
    return direction;
  }
  return undefined;
}

/**
 * Gets the optimization bounds from an annotation config.
 * For continuous configs, uses the lower/upper bounds directly.
 * For categorical configs, calculates bounds from the min/max scores of the values.
 */
export function getOptimizationBounds(config: AnnotationConfig | undefined): {
  lowerBound: number | undefined;
  upperBound: number | undefined;
  optimizationDirection: OptimizationDirectionResult;
} {
  if (config == null) {
    return {
      lowerBound: undefined,
      upperBound: undefined,
      optimizationDirection: undefined,
    };
  }

  if (config.annotationType === "FREEFORM") {
    return {
      lowerBound: undefined,
      upperBound: undefined,
      optimizationDirection: undefined,
    };
  }

  const optimizationDirection = normalizeOptimizationDirection(
    config.optimizationDirection
  );

  if (config.annotationType === "CONTINUOUS") {
    return {
      lowerBound: config.lowerBound ?? undefined,
      upperBound: config.upperBound ?? undefined,
      optimizationDirection,
    };
  }

  // CATEGORICAL
  const lowerBound = config.values?.reduce((acc, value) => {
    if (value.score == null) {
      return acc;
    }
    return value.score < acc ? value.score : acc;
  }, Infinity);

  const upperBound = config.values?.reduce((acc, value) => {
    if (value.score == null) {
      return acc;
    }
    return value.score > acc ? value.score : acc;
  }, -Infinity);

  return {
    lowerBound: lowerBound === Infinity ? undefined : lowerBound,
    upperBound: upperBound === -Infinity ? undefined : upperBound,
    optimizationDirection,
  };
}

/**
 * Determines if a score represents a "positive" optimization result.
 *
 * The score is compared against the midpoint between the lower and upper bounds.
 * For MAXIMIZE direction: returns true if score is above the midpoint
 * For MINIMIZE direction: returns true if score is below the midpoint
 *
 * Returns null if the optimization status cannot be determined (missing bounds, score, or direction).
 */
export function getPositiveOptimization({
  score,
  lowerBound,
  upperBound,
  optimizationDirection,
}: {
  score: number | null | undefined;
  lowerBound: number | undefined;
  upperBound: number | undefined;
  optimizationDirection: OptimizationDirectionResult;
}): boolean | null {
  if (
    score == null ||
    upperBound == null ||
    lowerBound == null ||
    optimizationDirection == null
  ) {
    return null;
  }

  const midpoint = (lowerBound + upperBound) / 2;

  return optimizationDirection === "MAXIMIZE"
    ? score > midpoint
    : score < midpoint;
}

/**
 * Determines if a score represents a "positive" optimization result based on an annotation config.
 *
 * This is a convenience function that combines `getOptimizationBounds` and `getPositiveOptimization`.
 *
 * @example
 * ```ts
 * const positiveOptimization = getPositiveOptimizationFromConfig({
 *   config: annotationConfig,
 *   score: annotation.score,
 * });
 * ```
 */
export function getPositiveOptimizationFromConfig({
  config,
  score,
}: {
  config: AnnotationConfig | undefined;
  score: number | null | undefined;
}): boolean | null {
  const { lowerBound, upperBound, optimizationDirection } =
    getOptimizationBounds(config);

  return getPositiveOptimization({
    score,
    lowerBound,
    upperBound,
    optimizationDirection,
  });
}

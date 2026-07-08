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
 * For freeform configs, returns an optional threshold that overrides the midpoint computation.
 */
export function getOptimizationBounds(config: AnnotationConfig | undefined): {
  lowerBound: number | undefined;
  upperBound: number | undefined;
  threshold: number | undefined;
  optimizationDirection: OptimizationDirectionResult;
} {
  if (config == null) {
    return {
      lowerBound: undefined,
      upperBound: undefined,
      threshold: undefined,
      optimizationDirection: undefined,
    };
  }

  if (config.annotationType === "FREEFORM") {
    return {
      lowerBound: config.lowerBound ?? undefined,
      upperBound: config.upperBound ?? undefined,
      threshold: config.threshold ?? undefined,
      optimizationDirection: normalizeOptimizationDirection(
        config.optimizationDirection
      ),
    };
  }

  const optimizationDirection = normalizeOptimizationDirection(
    config.optimizationDirection
  );

  if (config.annotationType === "CONTINUOUS") {
    return {
      lowerBound: config.lowerBound ?? undefined,
      upperBound: config.upperBound ?? undefined,
      threshold: undefined,
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
    threshold: undefined,
    optimizationDirection,
  };
}

/**
 * Determines if a score represents a "positive" optimization result.
 *
 * Uses `threshold` as the pivot when provided; falls back to `(lowerBound + upperBound) / 2`
 * when both bounds are defined. Returns null when no pivot can be determined.
 * For MAXIMIZE direction: returns true if score is above the pivot.
 * For MINIMIZE direction: returns true if score is below the pivot.
 *
 * Returns null if the optimization status cannot be determined (missing pivot, score, or direction).
 */
export function getPositiveOptimization({
  score,
  lowerBound,
  upperBound,
  threshold,
  optimizationDirection,
}: {
  score: number | null | undefined;
  lowerBound: number | undefined;
  upperBound: number | undefined;
  threshold?: number | undefined;
  optimizationDirection: OptimizationDirectionResult;
}): boolean | null {
  if (score == null || optimizationDirection == null) {
    return null;
  }

  const pivot =
    threshold != null
      ? threshold
      : lowerBound != null && upperBound != null
        ? (lowerBound + upperBound) / 2
        : undefined;

  if (pivot == null) {
    return null;
  }

  return optimizationDirection === "MAXIMIZE" ? score > pivot : score < pivot;
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
  const { lowerBound, upperBound, threshold, optimizationDirection } =
    getOptimizationBounds(config);

  return getPositiveOptimization({
    score,
    lowerBound,
    upperBound,
    threshold,
    optimizationDirection,
  });
}

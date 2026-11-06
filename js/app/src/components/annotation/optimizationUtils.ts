import type { AnnotationConfig } from "./types";

/**
 * A normalized optimization direction. `undefined` stands for "NONE" and for a
 * missing config.
 */
export type OptimizationDirectionResult = "MAXIMIZE" | "MINIMIZE" | undefined;

export type AnnotationOptimizationConfig = {
  readonly annotationType: AnnotationConfig["annotationType"];
  readonly optimizationDirection?: string | null;
  readonly lowerBound?: number | null;
  readonly upperBound?: number | null;
  readonly threshold?: number | null;
  readonly values?: ReadonlyArray<{
    readonly label?: string;
    readonly score: number | null;
  }>;
};

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
export function getOptimizationBounds(
  config: AnnotationOptimizationConfig | undefined
): {
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
 * Maps a score onto a signed optimization value from `-1` (worst) through
 * `0` (neutral) to `1` (best).
 *
 * The pivot is `threshold`, else the midpoint of the bounds; a score at the
 * pivot is neutral. Each side of the pivot is scaled to its own range, so an
 * off-center threshold still reaches both ends, and scores outside the bounds
 * are clamped. A side with no bound has no range to scale, so any score on
 * that side is `1` or `-1`.
 *
 * Returns null when the score or direction is missing or no pivot can be
 * determined.
 */
export function getOptimizationValue({
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
}): number | null {
  if (score == null || optimizationDirection == null) {
    return null;
  }

  const pivot =
    threshold ??
    (lowerBound != null && upperBound != null
      ? (lowerBound + upperBound) / 2
      : undefined);

  if (pivot == null) {
    return null;
  }

  const signedDistance =
    optimizationDirection === "MAXIMIZE" ? score - pivot : pivot - score;
  const bestBound =
    optimizationDirection === "MAXIMIZE" ? upperBound : lowerBound;
  const worstBound =
    optimizationDirection === "MAXIMIZE" ? lowerBound : upperBound;
  const sideBound = signedDistance >= 0 ? bestBound : worstBound;
  const sideRange = sideBound == null ? 0 : Math.abs(sideBound - pivot);

  if (sideRange === 0) {
    return Math.sign(signedDistance);
  }

  return Math.max(-1, Math.min(1, signedDistance / sideRange));
}

/**
 * Maps a score onto the optimization value of an annotation config.
 *
 * This is a convenience function that combines `getOptimizationBounds` and
 * `getOptimizationValue`.
 *
 * @example
 * ```ts
 * const optimizationValue = getOptimizationValueFromConfig({
 *   config: annotationConfig,
 *   score: annotation.score,
 * });
 * ```
 */
export function getOptimizationValueFromConfig({
  config,
  score,
}: {
  config: AnnotationOptimizationConfig | undefined;
  score: number | null | undefined;
}): number | null {
  const { lowerBound, upperBound, threshold, optimizationDirection } =
    getOptimizationBounds(config);

  return getOptimizationValue({
    score,
    lowerBound,
    upperBound,
    threshold,
    optimizationDirection,
  });
}

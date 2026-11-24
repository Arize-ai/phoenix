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
    readonly label?: string | null;
    readonly score: number | null;
  }>;
};

/**
 * The subset of a GraphQL annotation config that carries optimization metadata.
 * Annotation configs and evaluator output configs are the same GraphQL types, so
 * both selections satisfy this.
 */
type OptimizationConfigFields = {
  readonly annotationType?:
    | AnnotationOptimizationConfig["annotationType"]
    | null;
  readonly optimizationDirection?: string | null;
  readonly lowerBound?: number | null;
  readonly upperBound?: number | null;
  readonly threshold?: number | null;
  readonly values?: AnnotationOptimizationConfig["values"];
};

/**
 * Narrows a selected annotation or output config to its optimization metadata.
 *
 * Returns undefined for a config with no annotation type, which is what an
 * unmatched inline fragment leaves behind and cannot be interpreted.
 */
export function toAnnotationOptimizationConfig(
  config: OptimizationConfigFields
): AnnotationOptimizationConfig | undefined {
  if (config.annotationType == null) {
    return undefined;
  }
  return {
    annotationType: config.annotationType,
    optimizationDirection: config.optimizationDirection,
    lowerBound: config.lowerBound,
    upperBound: config.upperBound,
    threshold: config.threshold,
    values: config.values,
  };
}

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
 * For continuous configs, uses the lower/upper bounds directly, and the threshold
 * when one is saved or a decision evaluator's Yes / No output carries one.
 * For categorical configs, calculates bounds from the min/max scores of the values.
 * For freeform configs, returns an optional threshold that overrides the midpoint computation.
 */
export function getOptimizationBounds(
  config: AnnotationOptimizationConfig | undefined
): {
  lowerBound: number | undefined;
  upperBound: number | undefined;
  threshold: number | undefined;
  /** Whether a score exactly at `threshold` is on its high side. */
  isThresholdHighSide: boolean;
  optimizationDirection: OptimizationDirectionResult;
} {
  if (config == null) {
    return {
      lowerBound: undefined,
      upperBound: undefined,
      threshold: undefined,
      isThresholdHighSide: false,
      optimizationDirection: undefined,
    };
  }

  if (config.annotationType === "FREEFORM") {
    return {
      lowerBound: config.lowerBound ?? undefined,
      upperBound: config.upperBound ?? undefined,
      threshold: config.threshold ?? undefined,
      isThresholdHighSide: false,
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
      // A saved threshold, or a decision Yes / No question's (where its label
      // flips), replaces the bounds' midpoint as the pivot. A score at it is on
      // its high side, as a Yes / No label is true from its threshold up.
      threshold: config.threshold ?? undefined,
      isThresholdHighSide: config.threshold != null,
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
    isThresholdHighSide: false,
    optimizationDirection,
  };
}

/**
 * The score that separates positive from negative results: `threshold` when
 * provided, the midpoint of the bounds when both are defined, undefined when
 * neither pins it down.
 */
function getOptimizationPivot({
  lowerBound,
  upperBound,
  threshold,
}: {
  lowerBound: number | undefined;
  upperBound: number | undefined;
  threshold?: number | undefined;
}): number | undefined {
  return threshold != null
    ? threshold
    : lowerBound != null && upperBound != null
      ? (lowerBound + upperBound) / 2
      : undefined;
}

/**
 * The smallest magnitude a score on a threshold's high side maps to, so a score
 * exactly at the threshold reads as good or bad rather than neutral. It is the
 * colour scale's smallest step, which keeps the gradient as it is.
 */
const THRESHOLD_HIGH_SIDE_MIN_MAGNITUDE = 0.01;

/**
 * Maps a score onto a signed optimization value from `-1` (worst) through
 * `0` (neutral) to `1` (best).
 *
 * The pivot is `threshold`, else the midpoint of the bounds; a score at the
 * pivot is neutral, unless `isThresholdHighSide` puts a score at the threshold
 * on its high side: good under MAXIMIZE, bad under MINIMIZE. Each side of the pivot is scaled to its own range, so an
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
  isThresholdHighSide = false,
  optimizationDirection,
}: {
  score: number | null | undefined;
  lowerBound: number | undefined;
  upperBound: number | undefined;
  threshold?: number | undefined;
  isThresholdHighSide?: boolean;
  optimizationDirection: OptimizationDirectionResult;
}): number | null {
  if (score == null || optimizationDirection == null) {
    return null;
  }

  const pivot = getOptimizationPivot({ lowerBound, upperBound, threshold });

  if (pivot == null) {
    return null;
  }

  if (isThresholdHighSide && threshold != null && score >= threshold) {
    // The high side runs from the threshold to the upper bound, whichever
    // direction makes it the good one.
    const highSign = optimizationDirection === "MAXIMIZE" ? 1 : -1;
    const highRange = upperBound == null ? 0 : upperBound - threshold;
    const magnitude =
      highRange <= 0 ? 1 : Math.min(1, (score - threshold) / highRange);
    return highSign * Math.max(THRESHOLD_HIGH_SIDE_MIN_MAGNITUDE, magnitude);
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
  return getOptimizationValue({ score, ...getOptimizationBounds(config) });
}

/**
 * Classifies a two-label distribution as good versus bad, returning one flag
 * per label in the order given.
 *
 * Returns null when the labels carry no such meaning, so callers can fall back
 * to a neutral treatment instead of implying one. That covers:
 *
 * - anything other than exactly two labels
 * - no optimization direction on the config
 * - a label the config gives no score
 * - a label whose score sits exactly at the pivot — neither good nor bad
 * - both labels on the same side of the pivot
 */
export function getBinaryLabelOptimizations({
  config,
  labels,
}: {
  config: AnnotationOptimizationConfig | undefined;
  labels: ReadonlyArray<string>;
}): ReadonlyArray<boolean> | null {
  if (labels.length !== 2) {
    return null;
  }
  const { lowerBound, upperBound, threshold, optimizationDirection } =
    getOptimizationBounds(config);
  if (optimizationDirection == null) {
    return null;
  }
  const pivot = getOptimizationPivot({ lowerBound, upperBound, threshold });
  if (pivot == null) {
    return null;
  }
  const optimizations: boolean[] = [];
  for (const label of labels) {
    const score = config?.values?.find((value) => value.label === label)?.score;
    // A score at the pivot (e.g. the middle of a three-value scale) is neither
    // good nor bad; painting it as either would mislead.
    if (score == null || score === pivot) {
      return null;
    }
    optimizations.push(
      optimizationDirection === "MAXIMIZE" ? score > pivot : score < pivot
    );
  }
  // Two labels on the same side of the pivot are not a positive/negative pair.
  if (optimizations[0] === optimizations[1]) {
    return null;
  }
  return optimizations;
}

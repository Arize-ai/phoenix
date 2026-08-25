import type { AnnotationConfig } from "./types";

type OptimizationDirectionResult = "MAXIMIZE" | "MINIMIZE" | undefined;

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

  const pivot = getOptimizationPivot({ lowerBound, upperBound, threshold });

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
  config: AnnotationOptimizationConfig | undefined;
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

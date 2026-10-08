import type {
  AnnotationOptimizationConfig,
  OptimizationDirectionResult,
} from "@phoenix/components/annotation/optimizationUtils";
import { getOptimizationBounds } from "@phoenix/components/annotation/optimizationUtils";
import { assertUnreachable } from "@phoenix/typeUtils";
import {
  costFormatter,
  formatPercent,
  formatPercentShort,
  latencyMsFormatter,
  numberFormatter,
} from "@phoenix/utils/numberFormatUtils";

/**
 * Whether a change moved the metric in its good direction. `neutral` covers
 * metrics with no optimization direction and changes inside the neutral band.
 */
export type DeltaDirection = "improved" | "regressed" | "neutral";

/** Which form of a changed delta the inline token shows. */
export type DeltaDisplay = "relative" | "absolute";

export type MetricDelta =
  | { kind: "undefined" }
  | { kind: "unchanged" }
  | {
      kind: "changed";
      /** compare − base */
      absolute: number;
      /** (compare − base) / |base|; null when the base is 0 */
      relative: number | null;
      /** Whether the compare value is above or below the base */
      sign: "up" | "down";
      direction: DeltaDirection;
    };

export type LabelDelta =
  | { kind: "undefined" }
  | { kind: "unchanged"; label: string }
  | {
      kind: "changed";
      baseLabel: string;
      compareLabel: string;
      direction: DeltaDirection;
    };

/**
 * Relative changes below this magnitude are colored neutral so run-to-run
 * jitter in latency, tokens and cost does not read as movement.
 */
export const DEFAULT_RELATIVE_NEUTRAL_THRESHOLD = 0.01;

/** Latency, tokens and cost are better when lower. */
export const OPERATIONAL_METRIC_OPTIMIZATION_DIRECTION: OptimizationDirectionResult =
  "MINIMIZE";

/** The app's placeholder for a number it does not have. */
export const MISSING_VALUE_TEXT = "--";

/** The inline text for a delta whose two sides are equal. */
export const UNCHANGED_DELTA_TEXT = "no change";

type MaybeNumber = number | null | undefined;

/**
 * A metric aggregated over an experiment's runs that is compared against a
 * base or baseline experiment.
 */
export type ExperimentRunMetric = "latency" | "tokens" | "cost" | "errorRate";

/**
 * The experiment fields the run metrics derive from. `errorRate` is optional
 * since not every surface fetches it.
 */
export type ExperimentRunMetricsSource = {
  readonly runCount: number;
  readonly averageRunLatencyMs: number | null;
  readonly errorRate?: number | null;
  readonly costSummary: {
    readonly total: {
      readonly cost: number | null;
      readonly tokens: number | null;
    };
  };
};

export type ExperimentRunMetricDefinition = {
  /** What the number is, for tooltips and aria-labels */
  label: string;
  /** Formats values and absolute magnitudes */
  formatter: (value: MaybeNumber) => string;
  /** Which form a change shows */
  display: DeltaDisplay;
};

/**
 * Formats an error rate fraction as a percentage, e.g. `0.125` → `12.50%`.
 */
export function formatErrorRate(rate: MaybeNumber): string {
  return rate == null ? MISSING_VALUE_TEXT : formatPercent(rate * 100);
}

/**
 * How each run metric is labeled and formatted. Latency, tokens and cost show
 * the relative change; the error rate shows the change in percentage points.
 */
export const EXPERIMENT_RUN_METRICS: Record<
  ExperimentRunMetric,
  ExperimentRunMetricDefinition
> = {
  latency: {
    label: "Average latency",
    formatter: latencyMsFormatter,
    display: "relative",
  },
  tokens: {
    label: "Average tokens per run",
    formatter: numberFormatter,
    display: "relative",
  },
  cost: {
    label: "Average cost per run",
    formatter: costFormatter,
    display: "relative",
  },
  errorRate: {
    label: "Error rate",
    formatter: formatErrorRate,
    display: "absolute",
  },
};

/**
 * Relative tolerance under which two values count as equal, so floating-point
 * noise from summing the same scores in a different order is not a change.
 */
const EQUALITY_RELATIVE_TOLERANCE = 1e-9;

/**
 * Whether two values are equal within floating-point noise.
 */
function areNearlyEqual({ a, b }: { a: number; b: number }): boolean {
  return (
    Math.abs(a - b) <=
    EQUALITY_RELATIVE_TOLERANCE * Math.max(Math.abs(a), Math.abs(b))
  );
}

/**
 * Resolves whether a signed change is good, bad or neutral for a direction.
 */
function resolveDeltaDirection({
  change,
  optimizationDirection,
}: {
  change: number;
  optimizationDirection: OptimizationDirectionResult;
}): DeltaDirection {
  if (optimizationDirection == null || change === 0) {
    return "neutral";
  }
  const isBetter =
    optimizationDirection === "MAXIMIZE" ? change > 0 : change < 0;
  return isBetter ? "improved" : "regressed";
}

/**
 * Compares a numeric metric against its base value.
 * @param params.base - the base experiment's value
 * @param params.compare - the compare experiment's value
 * @param params.optimizationDirection - which way is better; undefined yields a neutral change
 * @param params.neutralThreshold - relative magnitude below which a change is neutral (default 0)
 */
export function computeMetricDelta({
  base,
  compare,
  optimizationDirection,
  neutralThreshold = 0,
}: {
  base: MaybeNumber;
  compare: MaybeNumber;
  optimizationDirection: OptimizationDirectionResult;
  neutralThreshold?: number;
}): MetricDelta {
  if (base == null || compare == null) {
    return { kind: "undefined" };
  }
  if (areNearlyEqual({ a: base, b: compare })) {
    return { kind: "unchanged" };
  }
  const absolute = compare - base;
  const relative = base === 0 ? null : absolute / Math.abs(base);
  const isInsideNeutralBand =
    relative != null && Math.abs(relative) < neutralThreshold;
  const direction = isInsideNeutralBand
    ? "neutral"
    : resolveDeltaDirection({ change: absolute, optimizationDirection });
  return {
    kind: "changed",
    absolute,
    relative,
    sign: absolute > 0 ? "up" : "down",
    direction,
  };
}

/**
 * Compares an operational metric (latency, tokens or cost) against its base
 * value: lower is better, and changes inside the neutral band are neutral.
 * @param params.base - the base experiment's value
 * @param params.compare - the compare experiment's value
 */
export function computeOperationalMetricDelta({
  base,
  compare,
}: {
  base: MaybeNumber;
  compare: MaybeNumber;
}): MetricDelta {
  return computeMetricDelta({
    base,
    compare,
    optimizationDirection: OPERATIONAL_METRIC_OPTIMIZATION_DIRECTION,
    neutralThreshold: DEFAULT_RELATIVE_NEUTRAL_THRESHOLD,
  });
}

/**
 * Indexes annotation summaries by annotation name.
 */
export function indexSummariesByAnnotationName<
  T extends { readonly annotationName: string },
>(summaries: readonly T[] | undefined): Partial<Record<string, T>> {
  return Object.fromEntries(
    (summaries ?? []).map((summary) => [summary.annotationName, summary])
  );
}

/**
 * Looks up the score a categorical config assigns to a label.
 */
function getLabelScore({
  config,
  label,
}: {
  config: AnnotationOptimizationConfig | undefined;
  label: string;
}): number | null {
  const value = config?.values?.find((candidate) => candidate.label === label);
  return value?.score ?? null;
}

/**
 * Compares a categorical label against the base run's label. The direction
 * comes from the scores the config assigns to each label; without scores or a
 * direction the change is neutral.
 * @param params.baseLabel - the base run's label
 * @param params.compareLabel - the compare run's label
 * @param params.config - the annotation's config, for label scores and direction
 */
export function computeLabelDelta({
  baseLabel,
  compareLabel,
  config,
}: {
  baseLabel: string | null | undefined;
  compareLabel: string | null | undefined;
  config?: AnnotationOptimizationConfig;
}): LabelDelta {
  if (baseLabel == null || compareLabel == null) {
    return { kind: "undefined" };
  }
  if (baseLabel === compareLabel) {
    return { kind: "unchanged", label: baseLabel };
  }
  const baseScore = getLabelScore({ config, label: baseLabel });
  const compareScore = getLabelScore({ config, label: compareLabel });
  const { optimizationDirection } = getOptimizationBounds(config);
  const direction =
    baseScore == null || compareScore == null
      ? "neutral"
      : resolveDeltaDirection({
          change: compareScore - baseScore,
          optimizationDirection,
        });
  return { kind: "changed", baseLabel, compareLabel, direction };
}

/**
 * Divides a group total by its run count; null when either is missing.
 * @param params.total - the group's total
 * @param params.runCount - the number of runs the total spans
 */
export function computeMeanPerRun({
  total,
  runCount,
}: {
  total: MaybeNumber;
  runCount: number;
}): number | null {
  if (total == null || runCount === 0) {
    return null;
  }
  return total / runCount;
}

/**
 * An experiment's per-run value of a metric. Token and cost totals are divided
 * by the run count so experiments with different run counts compare.
 * @param params.experiment - the experiment's aggregate fields
 * @param params.metric - which run metric to read
 */
export function getExperimentRunMetricValue({
  experiment,
  metric,
}: {
  experiment: ExperimentRunMetricsSource;
  metric: ExperimentRunMetric;
}): number | null {
  switch (metric) {
    case "latency":
      return experiment.averageRunLatencyMs;
    case "tokens":
      return computeMeanPerRun({
        total: experiment.costSummary.total.tokens,
        runCount: experiment.runCount,
      });
    case "cost":
      return computeMeanPerRun({
        total: experiment.costSummary.total.cost,
        runCount: experiment.runCount,
      });
    case "errorRate":
      return experiment.errorRate ?? null;
    default:
      return assertUnreachable(metric);
  }
}

/**
 * Compares an experiment's per-run metric against the base experiment's:
 * lower is better, and changes inside the neutral band are neutral.
 * @param params.base - the base experiment's aggregate fields
 * @param params.compare - the compare experiment's aggregate fields
 * @param params.metric - which run metric to compare
 */
export function computeExperimentRunMetricDelta({
  base,
  compare,
  metric,
}: {
  base: ExperimentRunMetricsSource;
  compare: ExperimentRunMetricsSource;
  metric: ExperimentRunMetric;
}): MetricDelta {
  return computeOperationalMetricDelta({
    base: getExperimentRunMetricValue({ experiment: base, metric }),
    compare: getExperimentRunMetricValue({ experiment: compare, metric }),
  });
}

/**
 * Formats a relative change as an unsigned percentage, e.g. `0.364` → `36%`.
 */
export function formatRelativeDelta(relative: number): string {
  return formatPercentShort(Math.abs(relative) * 100);
}

/**
 * Whether a changed delta shows its relative or absolute form: the requested
 * form, falling back to absolute when the base is 0 and no relative change
 * exists.
 */
function resolveDeltaDisplay({
  delta,
  display,
}: {
  delta: Extract<MetricDelta, { kind: "changed" }>;
  display: DeltaDisplay;
}): DeltaDisplay {
  return display === "relative" && delta.relative == null
    ? "absolute"
    : display;
}

/**
 * The unsigned magnitude of a changed delta in the display it resolves to.
 */
function formatDeltaMagnitude({
  delta,
  display,
  formatter,
}: {
  delta: Extract<MetricDelta, { kind: "changed" }>;
  display: DeltaDisplay;
  formatter: (value: number) => string;
}): string {
  const resolvedDisplay = resolveDeltaDisplay({ delta, display });
  return resolvedDisplay === "relative" && delta.relative != null
    ? formatRelativeDelta(delta.relative)
    : formatter(Math.abs(delta.absolute));
}

/**
 * The text of the inline token after the sign glyph: a magnitude for a
 * change, `no change`, or `--` when there is nothing to compare.
 * @param params.delta - the computed delta
 * @param params.display - which form a change shows; a 0 base falls back to absolute
 * @param params.formatter - formats absolute magnitudes (default `numberFormatter`)
 */
export function formatMetricDelta({
  delta,
  display,
  formatter = numberFormatter,
}: {
  delta: MetricDelta;
  display: DeltaDisplay;
  formatter?: (value: number) => string;
}): string {
  switch (delta.kind) {
    case "undefined":
      return MISSING_VALUE_TEXT;
    case "unchanged":
      return UNCHANGED_DELTA_TEXT;
    case "changed":
      return formatDeltaMagnitude({ delta, display, formatter });
    default:
      return assertUnreachable(delta);
  }
}

/**
 * The signed absolute change with the signed relative change in parentheses
 * when it exists, e.g. `−$0.59 (−40%)`.
 * @param params.delta - a changed delta
 * @param params.formatter - formats the absolute magnitude
 */
export function formatSignedMetricDelta({
  delta,
  formatter = numberFormatter,
}: {
  delta: Extract<MetricDelta, { kind: "changed" }>;
  formatter?: (value: number) => string;
}): string {
  const signPrefix = delta.sign === "up" ? "+" : "−";
  const absoluteText = `${signPrefix}${formatter(Math.abs(delta.absolute))}`;
  if (delta.relative == null) {
    return absoluteText;
  }
  return `${absoluteText} (${signPrefix}${formatRelativeDelta(delta.relative)})`;
}

/**
 * The parenthetical a sentence ends with when a change has a direction.
 */
function describeDirection(direction: DeltaDirection): string {
  return direction === "neutral" ? "" : ` (${direction})`;
}

/**
 * A one-sentence description of a metric delta for `aria-label` and
 * tooltips, e.g. `Cost decreased 40% vs base (improved)`.
 * @param params.metricLabel - what the number is: `Latency`, `Total tokens`, `reward`
 * @param params.delta - the computed delta
 * @param params.display - which form a change shows
 * @param params.formatter - formats absolute magnitudes
 */
export function describeMetricDelta({
  metricLabel,
  delta,
  display,
  formatter = numberFormatter,
}: {
  metricLabel: string;
  delta: MetricDelta;
  display: DeltaDisplay;
  formatter?: (value: number) => string;
}): string {
  switch (delta.kind) {
    case "undefined":
      return `No comparison available for ${metricLabel}`;
    case "unchanged":
      return `${metricLabel} unchanged vs base`;
    case "changed": {
      const verb = delta.sign === "up" ? "increased" : "decreased";
      const magnitude = formatDeltaMagnitude({ delta, display, formatter });
      return `${metricLabel} ${verb} ${magnitude} vs base${describeDirection(delta.direction)}`;
    }
    default:
      return assertUnreachable(delta);
  }
}

/**
 * A one-sentence description of a label delta for `aria-label` and tooltips,
 * e.g. `status label changed from ok to error (regressed)`.
 * @param params.annotationName - the annotation the label belongs to
 * @param params.delta - the computed delta
 */
export function describeLabelDelta({
  annotationName,
  delta,
}: {
  annotationName: string;
  delta: LabelDelta;
}): string {
  switch (delta.kind) {
    case "undefined":
      return `No comparison available for ${annotationName}`;
    case "unchanged":
      return `${annotationName} label unchanged vs base: ${delta.label}`;
    case "changed":
      return `${annotationName} label changed from ${delta.baseLabel} to ${delta.compareLabel}${describeDirection(delta.direction)}`;
    default:
      return assertUnreachable(delta);
  }
}

/**
 * The inline text for a label delta: `was <base label>` for a change,
 * `no change`, or `--` when there is nothing to compare.
 */
export function formatLabelDelta(delta: LabelDelta): string {
  switch (delta.kind) {
    case "undefined":
      return MISSING_VALUE_TEXT;
    case "unchanged":
      return UNCHANGED_DELTA_TEXT;
    case "changed":
      return `was ${delta.baseLabel}`;
    default:
      return assertUnreachable(delta);
  }
}

/**
 * The visual state a delta renders in, which names its BEM modifier:
 * a direction for a change, otherwise the kind itself.
 */
export function getDeltaState(
  delta: MetricDelta | LabelDelta
): DeltaDirection | "unchanged" | "undefined" {
  return delta.kind === "changed" ? delta.direction : delta.kind;
}

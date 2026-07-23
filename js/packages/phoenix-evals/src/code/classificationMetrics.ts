/**
 * A label produced by a classifier. Must be a primitive so it can be compared
 * for equality and used as a lookup key.
 */
export type ClassificationLabel = string | number;

/**
 * The strategy used to aggregate per-class precision/recall/F-score into a
 * single number when there are more than two classes (or no `positiveLabel`
 * is configured).
 *
 * - `"macro"`: unweighted mean across classes.
 * - `"micro"`: pool true/false positives and false negatives across classes
 *   before computing the metric.
 * - `"weighted"`: mean across classes, weighted by each class's support
 *   (number of true instances).
 */
export type AverageType = "macro" | "micro" | "weighted";

/**
 * The example shape expected by the classification-metric evaluators.
 */
export interface ClassificationExample {
  /** The ground-truth sequence of labels. */
  expected: ClassificationLabel[];
  /** The predicted sequence of labels, aligned by index with `expected`. */
  output: ClassificationLabel[];
  [key: string]: unknown;
}

/**
 * Options shared by precision, recall, and F-score computations.
 */
export interface PrecisionRecallFScoreOptions {
  /**
   * Weight of recall relative to precision in the F-score. Must be > 0.
   * @defaultValue 1
   */
  beta?: number;
  /**
   * Aggregation strategy across classes. Ignored when `positiveLabel` is set
   * (or auto-detected).
   * @defaultValue "macro"
   */
  average?: AverageType;
  /**
   * Value substituted for a metric when it is undefined (e.g. 0/0).
   * @defaultValue 0
   */
  zeroDivision?: number;
  /**
   * When set, compute binary precision/recall/F exclusively for this label
   * (one-vs-rest). If not set, `average` is at its default `"macro"`, and
   * the labels are the numeric set `{0, 1}`, the positive label defaults to
   * `1`. Otherwise, multi-class averaging is used. The auto-detection is
   * skipped whenever a non-default `average` is configured, so an explicit
   * `average` is never silently overridden by the shape of the data.
   */
  positiveLabel?: ClassificationLabel;
}

/**
 * The result of computing precision, recall, and F-score for a batch of
 * predictions.
 */
export interface PrecisionRecallFScoreResult {
  precision: number;
  recall: number;
  fScore: number;
  beta: number;
  average: AverageType;
  /** All labels observed in `expected` and `output`, in first-seen order. */
  labels: ClassificationLabel[];
  /** The label treated as positive in one-vs-rest mode, or `null` if multi-class averaging was used. */
  positiveLabel: ClassificationLabel | null;
}

interface ClassCounts {
  truePositive: number;
  falsePositive: number;
  falseNegative: number;
}

function validateBeta(beta: number): void {
  if (!(beta > 0)) {
    throw new Error("beta must be > 0");
  }
}

function validateAverage(average: AverageType): void {
  if (average !== "macro" && average !== "micro" && average !== "weighted") {
    throw new Error('average must be one of "macro", "micro", or "weighted"');
  }
}

function validateLabelSequences(
  expected: ClassificationLabel[],
  output: ClassificationLabel[]
): void {
  if (!Array.isArray(expected) || !Array.isArray(output)) {
    throw new Error("expected and output must be arrays of labels");
  }
  if (expected.length !== output.length) {
    throw new Error(
      `expected and output must have the same length. Got ${expected.length} and ${output.length}`
    );
  }
  if (expected.length === 0) {
    throw new Error("expected and output must be non-empty");
  }
}

function safeDivide(
  numerator: number,
  denominator: number,
  zeroDivision: number
): number {
  if (denominator === 0) {
    return zeroDivision;
  }
  return numerator / denominator;
}

function computeFScore(
  precision: number,
  recall: number,
  beta: number,
  zeroDivision: number
): number {
  if (precision === 0 && recall === 0) {
    return 0;
  }
  const betaSquared = beta * beta;
  const numerator = (1 + betaSquared) * precision * recall;
  const denominator = betaSquared * precision + recall;
  return safeDivide(numerator, denominator, zeroDivision);
}

/** Collects all unique labels, ordered by first appearance in `expected` then `output`. */
function collectLabels(
  expected: ClassificationLabel[],
  output: ClassificationLabel[]
): ClassificationLabel[] {
  const seen = new Set<ClassificationLabel>();
  const ordered: ClassificationLabel[] = [];
  for (const label of [...expected, ...output]) {
    if (!seen.has(label)) {
      seen.add(label);
      ordered.push(label);
    }
  }
  return ordered;
}

/**
 * Compares two labels the same way `Map`/`Set` key lookups do (SameValueZero),
 * so a `NaN` label matches another `NaN` label instead of always mismatching
 * under strict `===`.
 */
function labelsAreEqual(
  a: ClassificationLabel,
  b: ClassificationLabel
): boolean {
  return (
    a === b ||
    (typeof a === "number" &&
      typeof b === "number" &&
      Number.isNaN(a) &&
      Number.isNaN(b))
  );
}

function computeClassCounts(
  expected: ClassificationLabel[],
  output: ClassificationLabel[],
  labels: ClassificationLabel[]
): Map<ClassificationLabel, ClassCounts> {
  const countsByLabel = new Map<ClassificationLabel, ClassCounts>();
  for (const label of labels) {
    countsByLabel.set(label, {
      truePositive: 0,
      falsePositive: 0,
      falseNegative: 0,
    });
  }
  for (const [index, expectedLabel] of expected.entries()) {
    // `output` is validated to have the same length as `expected`.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- length-validated parallel index access
    const outputLabel = output[index] as ClassificationLabel;
    // `labels` is derived from these same `expected`/`output` arrays, so both
    // labels are always pre-populated keys in `countsByLabel`.
    if (labelsAreEqual(expectedLabel, outputLabel)) {
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- label pre-populated as a key in countsByLabel
      const counts = countsByLabel.get(expectedLabel) as ClassCounts;
      counts.truePositive += 1;
    } else {
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- label pre-populated as a key in countsByLabel
      const predictedCounts = countsByLabel.get(outputLabel) as ClassCounts;
      predictedCounts.falsePositive += 1;
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- label pre-populated as a key in countsByLabel
      const expectedCounts = countsByLabel.get(expectedLabel) as ClassCounts;
      expectedCounts.falseNegative += 1;
    }
  }
  return countsByLabel;
}

/**
 * Resolves the one-vs-rest positive label, if any. Auto-detection of a
 * numeric `{0, 1}` label set only applies under the default `"macro"`
 * average, so an explicitly configured `"micro"`/`"weighted"` average is
 * never silently replaced by binary one-vs-rest scoring.
 */
function resolvePositiveLabel(
  configuredPositiveLabel: ClassificationLabel | undefined,
  labels: ClassificationLabel[],
  average: AverageType
): ClassificationLabel | null {
  if (configuredPositiveLabel !== undefined) {
    return configuredPositiveLabel;
  }
  if (average !== "macro") {
    return null;
  }
  const uniqueLabels = new Set(labels);
  if (uniqueLabels.size === 2 && uniqueLabels.has(0) && uniqueLabels.has(1)) {
    return 1;
  }
  return null;
}

/**
 * Aggregates per-class precision/recall/F-score across all classes.
 *
 * Mirrors scikit-learn's `average` semantics: for `"macro"`/`"weighted"` the
 * F-score is computed per class and then averaged (not derived from the
 * aggregated precision/recall). For `"micro"` the per-class confusion counts
 * are pooled first, so the F-score is computed from the pooled
 * precision/recall.
 */
function aggregatePrecisionRecall(
  countsByLabel: Map<ClassificationLabel, ClassCounts>,
  average: AverageType,
  beta: number,
  zeroDivision: number
): { precision: number; recall: number; fScore: number } {
  if (average === "micro") {
    let truePositive = 0;
    let falsePositive = 0;
    let falseNegative = 0;
    for (const counts of countsByLabel.values()) {
      truePositive += counts.truePositive;
      falsePositive += counts.falsePositive;
      falseNegative += counts.falseNegative;
    }
    const precision = safeDivide(
      truePositive,
      truePositive + falsePositive,
      zeroDivision
    );
    const recall = safeDivide(
      truePositive,
      truePositive + falseNegative,
      zeroDivision
    );
    return {
      precision,
      recall,
      fScore: computeFScore(precision, recall, beta, zeroDivision),
    };
  }

  const perClassMetrics = Array.from(countsByLabel.values()).map((counts) => {
    const precision = safeDivide(
      counts.truePositive,
      counts.truePositive + counts.falsePositive,
      zeroDivision
    );
    const recall = safeDivide(
      counts.truePositive,
      counts.truePositive + counts.falseNegative,
      zeroDivision
    );
    return {
      precision,
      recall,
      fScore: computeFScore(precision, recall, beta, zeroDivision),
      support: counts.truePositive + counts.falseNegative,
    };
  });

  if (average === "macro") {
    return {
      precision: mean(perClassMetrics.map((m) => m.precision)),
      recall: mean(perClassMetrics.map((m) => m.recall)),
      fScore: mean(perClassMetrics.map((m) => m.fScore)),
    };
  }

  // weighted
  const totalSupport = perClassMetrics.reduce((sum, m) => sum + m.support, 0);
  if (totalSupport === 0) {
    return {
      precision: zeroDivision,
      recall: zeroDivision,
      fScore: zeroDivision,
    };
  }
  return {
    precision: weightedMean(perClassMetrics, "precision", totalSupport),
    recall: weightedMean(perClassMetrics, "recall", totalSupport),
    fScore: weightedMean(perClassMetrics, "fScore", totalSupport),
  };
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function weightedMean(
  perClassMetrics: Array<{
    precision: number;
    recall: number;
    fScore: number;
    support: number;
  }>,
  field: "precision" | "recall" | "fScore",
  totalSupport: number
): number {
  const weightedSum = perClassMetrics.reduce(
    (sum, metrics) => sum + metrics[field] * metrics.support,
    0
  );
  return weightedSum / totalSupport;
}

/**
 * Computes precision, recall, and F-beta score for a batch of expected vs.
 * predicted labels.
 *
 * `expected`/`output` are the full sequence of labels across an entire
 * dataset, not a single row — this and the evaluators built on it are
 * dataset-level, unlike the package's per-row LLM evaluators. Call it once
 * over every row's collected labels rather than wiring it into a per-row
 * pipeline (e.g. `runExperiment`'s per-row evaluators).
 *
 * Supports both binary classification (via `positiveLabel`, or
 * auto-detected when `average` is at its default `"macro"` and the labels
 * are the numeric set `{0, 1}`) and multi-class classification (via the
 * `average` strategy).
 *
 * @example Multi-class (macro average)
 * ```typescript
 * computePrecisionRecallFScore({
 *   expected: ["cat", "dog", "cat", "bird"],
 *   output: ["cat", "cat", "cat", "bird"],
 * });
 * // { precision: 5/9, recall: 2/3, fScore: 0.6, beta: 1, average: "macro", ... }
 * ```
 *
 * @example Binary with an explicit positive label
 * ```typescript
 * computePrecisionRecallFScore(
 *   { expected: ["spam", "ham", "spam"], output: ["spam", "spam", "ham"] },
 *   { beta: 0.5, positiveLabel: "spam" }
 * );
 * ```
 */
export function computePrecisionRecallFScore(
  { expected, output }: Pick<ClassificationExample, "expected" | "output">,
  options: PrecisionRecallFScoreOptions = {}
): PrecisionRecallFScoreResult {
  const {
    beta = 1,
    average = "macro",
    zeroDivision = 0,
    positiveLabel,
  } = options;

  validateBeta(beta);
  validateAverage(average);
  validateLabelSequences(expected, output);

  const labels = collectLabels(expected, output);
  const countsByLabel = computeClassCounts(expected, output, labels);
  const resolvedPositiveLabel = resolvePositiveLabel(
    positiveLabel,
    labels,
    average
  );

  if (resolvedPositiveLabel !== null) {
    const classCounts = countsByLabel.get(resolvedPositiveLabel);
    if (!classCounts) {
      throw new Error(
        `positiveLabel ${JSON.stringify(resolvedPositiveLabel)} not present in labels ${JSON.stringify(labels)}`
      );
    }
    const precision = safeDivide(
      classCounts.truePositive,
      classCounts.truePositive + classCounts.falsePositive,
      zeroDivision
    );
    const recall = safeDivide(
      classCounts.truePositive,
      classCounts.truePositive + classCounts.falseNegative,
      zeroDivision
    );
    return {
      precision,
      recall,
      fScore: computeFScore(precision, recall, beta, zeroDivision),
      beta,
      average,
      labels,
      positiveLabel: resolvedPositiveLabel,
    };
  }

  const { precision, recall, fScore } = aggregatePrecisionRecall(
    countsByLabel,
    average,
    beta,
    zeroDivision
  );
  return {
    precision,
    recall,
    fScore,
    beta,
    average,
    labels,
    positiveLabel: null,
  };
}

/**
 * Formats a beta value for use in metric names, e.g. `1` -> `"f1"`,
 * `0.5` -> `"f0_5"`.
 */
export function formatBetaForMetricName(beta: number): string {
  if (beta <= 0) {
    return "f";
  }
  if (Number.isInteger(beta)) {
    return `f${beta}`;
  }
  return `f${beta.toString().replace(".", "_")}`;
}

/**
 * The suffix appended to a metric name to reflect the aggregation strategy,
 * e.g. `"precision"` vs. `"precision_micro"`. No suffix is used when
 * `positiveLabel` is explicitly configured, since `average` is not
 * applicable in that one-vs-rest binary mode. This mirrors
 * `resolvePositiveLabel`'s auto-detection rule (only under the default
 * `"macro"` average) so a constructed evaluator's static name always
 * matches what `computePrecisionRecallFScore` actually computes.
 */
export function getAverageMetricNameSuffix({
  average = "macro",
  positiveLabel,
}: PrecisionRecallFScoreOptions): string {
  if (positiveLabel !== undefined) {
    return "";
  }
  return average === "macro" ? "" : `_${average}`;
}

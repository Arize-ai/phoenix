import type { TestResult } from "./state";
import type {
  AcceptanceCriterion,
  AcceptanceResult,
  Annotation,
  OptimizationDirection,
} from "./types";

interface AcceptanceSample {
  score: number | boolean;
}

/**
 * Evaluate all configured aggregate acceptance rules against completed runs.
 * @param params - Evaluation parameters.
 * @param params.criteria - Aggregate rules configured on the suite.
 * @param params.results - Completed test results in the suite.
 */
export function evaluateAcceptanceCriteria({
  criteria,
  results,
}: {
  criteria: readonly AcceptanceCriterion[] | undefined;
  results: readonly TestResult[];
}): AcceptanceResult[] {
  if (!criteria || criteria.length === 0) {
    return [];
  }
  return criteria.map((criterion) =>
    evaluateAcceptanceCriterion({ criterion, results })
  );
}

/**
 * Build one error containing every failed aggregate criterion.
 * @param results - Computed acceptance results.
 */
export function createAcceptanceFailureError(
  results: readonly AcceptanceResult[]
): Error | undefined {
  const failedResults = results.filter((result) => !result.passed);
  if (failedResults.length === 0) {
    return undefined;
  }
  return new Error(
    [
      "Acceptance criteria failed:",
      ...failedResults.map((result) => `  ${formatAcceptanceResult(result)}`),
    ].join("\n")
  );
}

/** Format an acceptance result for reporters and thrown errors. */
export function formatAcceptanceResult(result: AcceptanceResult): string {
  const status = result.passed ? "PASS" : "FAIL";
  const value = result.value === null ? "n/a" : result.value.toFixed(3);
  const cmp = (result.direction ?? "maximize") === "minimize" ? "<=" : ">=";
  const sampleLabel = result.sampleCount === 1 ? "sample" : "samples";
  const requirement =
    result.metric === "average"
      ? `mean ${cmp} ${result.threshold.toFixed(3)}`
      : `every run ${cmp} ${result.threshold.toFixed(3)}`;
  const reason = result.failureReason ? ` - ${result.failureReason}` : "";
  return `${status} ${result.annotationName} ${result.metric} ${value} (need ${requirement}; ${result.sampleCount} ${sampleLabel})${reason}`;
}

function evaluateAcceptanceCriterion({
  criterion,
  results,
}: {
  criterion: AcceptanceCriterion;
  results: readonly TestResult[];
}): AcceptanceResult {
  const samples = collectAcceptanceSamples({ criterion, results });
  if (samples.length === 0) {
    return {
      ...criterion,
      value: null,
      sampleCount: 0,
      passed: false,
      failureReason: "no numeric or boolean scores found",
    };
  }

  const direction = criterion.direction ?? "maximize";
  if (criterion.metric === "average") {
    const value = calculateAverage(samples);
    return {
      ...criterion,
      value,
      sampleCount: samples.length,
      passed: meetsBar(value, criterion.threshold, direction),
    };
  }

  // passThreshold: the suite passes only when every run clears the per-run bar.
  // The reported value is the fraction of runs that cleared it.
  const value = calculatePassRate({
    samples,
    threshold: criterion.threshold,
    direction,
  });
  return {
    ...criterion,
    value,
    sampleCount: samples.length,
    passed: value >= 1,
  };
}

/** Whether `value` clears `bar` in the given optimization direction. */
function meetsBar(
  value: number,
  bar: number,
  direction: OptimizationDirection
): boolean {
  return direction === "minimize" ? value <= bar : value >= bar;
}

function collectAcceptanceSamples({
  criterion,
  results,
}: {
  criterion: AcceptanceCriterion;
  results: readonly TestResult[];
}): AcceptanceSample[] {
  return results
    .filter((result) => result.status !== "skipped")
    .map((result) =>
      findLastAnnotation({
        annotations: result.annotations,
        annotationName: criterion.annotationName,
      })
    )
    .filter((annotation): annotation is Annotation => annotation !== undefined)
    .map((annotation) => annotation.score)
    .filter(isValidScore)
    .map((score) => ({ score }));
}

function findLastAnnotation({
  annotations,
  annotationName,
}: {
  annotations: readonly Annotation[];
  annotationName: string;
}): Annotation | undefined {
  for (
    let annotationIndex = annotations.length - 1;
    annotationIndex >= 0;
    annotationIndex--
  ) {
    const annotation = annotations[annotationIndex];
    if (annotation?.name === annotationName) {
      return annotation;
    }
  }
  return undefined;
}

function isValidScore(score: Annotation["score"]): score is number | boolean {
  return (
    typeof score === "boolean" ||
    (typeof score === "number" && Number.isFinite(score))
  );
}

function calculateAverage(samples: readonly AcceptanceSample[]): number {
  const total = samples
    .map((sample) => scoreToNumber(sample.score))
    .reduce((sum, score) => sum + score, 0);
  return total / samples.length;
}

function calculatePassRate({
  samples,
  threshold,
  direction,
}: {
  samples: readonly AcceptanceSample[];
  threshold: number;
  direction: OptimizationDirection;
}): number {
  const passed = samples.filter((sample) =>
    runPasses(sample.score, threshold, direction)
  ).length;
  return passed / samples.length;
}

/**
 * Whether a single run's score counts as a pass. Boolean scores pass on `true`
 * (or `false` when minimizing); numeric scores must clear `threshold`.
 */
function runPasses(
  score: number | boolean,
  threshold: number,
  direction: OptimizationDirection
): boolean {
  if (typeof score === "boolean") {
    return direction === "minimize" ? !score : score;
  }
  return meetsBar(score, threshold, direction);
}

function scoreToNumber(score: number | boolean): number {
  return typeof score === "boolean" ? (score ? 1 : 0) : score;
}

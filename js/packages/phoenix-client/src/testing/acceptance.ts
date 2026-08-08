import type { TestResult } from "./state";
import type {
  AcceptanceCriterion,
  AcceptanceResult,
  Annotation,
  OptimizationDirection,
} from "./types";

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
  const sampleLabel = result.sampleCount === 1 ? "sample" : "samples";
  let requirement: string;
  if (result.metric === "average") {
    const cmp = (result.direction ?? "maximize") === "minimize" ? "<=" : ">=";
    requirement = `mean ${cmp} ${result.threshold.toFixed(3)}`;
  } else {
    requirement = `pass rate >= ${result.minPassRate.toFixed(3)}`;
  }
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
  const annotations = collectAnnotations({ criterion, results });

  if (criterion.metric === "average") {
    // Only numeric / boolean scores can be averaged.
    const scores = annotations
      .map((annotation) => annotation.score)
      .filter(isValidScore);
    if (scores.length === 0) {
      return {
        ...criterion,
        value: null,
        sampleCount: 0,
        passed: false,
        failureReason: "no numeric or boolean scores found",
      };
    }
    const direction = criterion.direction ?? "maximize";
    const value = calculateAverage(scores);
    return {
      ...criterion,
      value,
      sampleCount: scores.length,
      passed: meetsBar(value, criterion.threshold, direction),
    };
  }

  // passRate: each run passes when `passFn` returns true for its annotation;
  // the suite passes when the fraction of passing runs is at least
  // `minPassRate`. The reported value is that fraction.
  if (annotations.length === 0) {
    return {
      ...criterion,
      value: null,
      sampleCount: 0,
      passed: false,
      failureReason: "no matching annotations found",
    };
  }
  const passed = annotations.filter((annotation) =>
    criterion.passFn(annotation)
  ).length;
  const value = passed / annotations.length;
  return {
    ...criterion,
    value,
    sampleCount: annotations.length,
    passed: value >= criterion.minPassRate,
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

/**
 * The last annotation matching `annotationName` from each non-skipped run that
 * logged it. One entry per run; runs that never logged the annotation are
 * omitted.
 */
function collectAnnotations({
  criterion,
  results,
}: {
  criterion: AcceptanceCriterion;
  results: readonly TestResult[];
}): Annotation[] {
  return results
    .filter((result) => result.status !== "skipped")
    .map((result) =>
      findLastAnnotation({
        annotations: result.annotations,
        annotationName: criterion.annotationName,
      })
    )
    .filter((annotation): annotation is Annotation => annotation !== undefined);
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

function calculateAverage(scores: readonly (number | boolean)[]): number {
  const total = scores
    .map(scoreToNumber)
    .reduce((sum, score) => sum + score, 0);
  return total / scores.length;
}

function scoreToNumber(score: number | boolean): number {
  return typeof score === "boolean" ? (score ? 1 : 0) : score;
}

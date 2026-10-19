import {
  type AnnotationOptimizationConfig,
  getOptimizationValueFromConfig,
} from "./optimizationUtils";
import type { AnnotationSummary } from "./types";

export type AnnotationLabelConsensus =
  /** One label is most common; `fraction` is its share, 1 when all agree */
  | { kind: "top"; label: string; fraction: number }
  /** Two or more labels tie for most common */
  | { kind: "mixed"; labelFractions: AnnotationSummary["labelFractions"] };

/**
 * How far the labels behind a summary agree, so a split vote never reads as
 * a verdict. `null` when the summary has no labels.
 */
export function getAnnotationLabelConsensus(
  summary: Pick<AnnotationSummary, "labelFractions">
): AnnotationLabelConsensus | null {
  const sorted = [...summary.labelFractions].sort(
    (first, second) => second.fraction - first.fraction
  );
  const [top, runnerUp] = sorted;
  if (top == null) {
    return null;
  }
  if (runnerUp != null && runnerUp.fraction === top.fraction) {
    return { kind: "mixed", labelFractions: sorted };
  }
  return { kind: "top", label: top.label, fraction: top.fraction };
}

/**
 * Unfavorable summaries first, then by name, so a row that clips its badges
 * never hides the one that flags a problem.
 */
export function sortAnnotationSummariesForTriage(
  summaries: readonly AnnotationSummary[],
  annotationConfigsByName: ReadonlyMap<string, AnnotationOptimizationConfig>
): AnnotationSummary[] {
  const isUnfavorable = new Map(
    summaries.map((summary) => [
      summary,
      (getOptimizationValueFromConfig({
        config: annotationConfigsByName.get(summary.name),
        score: summary.meanScore,
      }) ?? 0) < 0,
    ])
  );
  return [...summaries].sort((first, second) => {
    const firstIsUnfavorable = isUnfavorable.get(first) === true;
    const secondIsUnfavorable = isUnfavorable.get(second) === true;
    if (firstIsUnfavorable !== secondIsUnfavorable) {
      return firstIsUnfavorable ? -1 : 1;
    }
    return first.name.localeCompare(second.name);
  });
}

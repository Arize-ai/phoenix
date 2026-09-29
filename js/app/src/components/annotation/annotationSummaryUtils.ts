import type { AnnotationOptimizationConfig } from "./optimizationUtils";
import { getPositiveOptimizationFromConfig } from "./optimizationUtils";
import type { AnnotationSummary } from "./types";

/**
 * Whether the summary's mean score is favorable under its config. `null` when
 * there is no score or the config sets no optimization direction.
 */
export function getAnnotationSummaryPositiveOptimization({
  summary,
  annotationConfig,
}: {
  summary: Pick<AnnotationSummary, "meanScore">;
  annotationConfig: AnnotationOptimizationConfig | undefined;
}): boolean | null {
  return getPositiveOptimizationFromConfig({
    config: annotationConfig,
    score: summary.meanScore,
  });
}

/** The most frequent label, or `null` when no annotation has a label. */
export function getAnnotationSummaryTopLabel(
  summary: Pick<AnnotationSummary, "labelFractions">
): string | null {
  let top: AnnotationSummary["labelFractions"][number] | null = null;
  for (const entry of summary.labelFractions) {
    if (top == null || entry.fraction > top.fraction) {
      top = entry;
    }
  }
  return top?.label ?? null;
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
      getAnnotationSummaryPositiveOptimization({
        summary,
        annotationConfig: annotationConfigsByName.get(summary.name),
      }) === false,
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

import type { AnnotationOptimizationConfig } from "./optimizationUtils";
import { getPositiveOptimizationFromConfig } from "./optimizationUtils";
import type { AnnotationSummary } from "./types";

/**
 * Whether a summary's mean score is favorable under its config: `true` or
 * `false`, or `null` for label-only summaries and configs with no direction.
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

/** The label most of the summary's annotations carry, if any carry one. */
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
 * Orders summaries for a troubleshooting scan: unfavorable results first,
 * then everything else by name. A row that clips its badges thus hides the
 * favorable ones, never the one that flags a problem.
 */
export function sortAnnotationSummariesForTriage(
  summaries: readonly AnnotationSummary[],
  annotationConfigsByName: ReadonlyMap<string, AnnotationOptimizationConfig>
): AnnotationSummary[] {
  // Judged once per summary, not once per comparison
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

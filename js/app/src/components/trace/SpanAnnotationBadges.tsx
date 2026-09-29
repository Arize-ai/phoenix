import { OverflowRow } from "@phoenix/components";
import { AnnotationSummaryBadge } from "@phoenix/components/annotation/AnnotationSummaryBadge";
import { sortAnnotationSummariesForTriage } from "@phoenix/components/annotation/annotationSummaryUtils";
import type { AnnotationOptimizationConfig } from "@phoenix/components/annotation/optimizationUtils";
import type { AnnotationSummary } from "@phoenix/components/annotation/types";
import { classNames } from "@phoenix/utils/classNames";

export type SpanAnnotationBadgesProps = {
  /** The span's per-name annotation summaries, in any order. */
  summaries: readonly AnnotationSummary[] | null | undefined;
  /** Project annotation configs by name; decide each badge's color. */
  annotationConfigsByName: ReadonlyMap<string, AnnotationOptimizationConfig>;
  /** Positions the line within its row. */
  className?: string;
};

/**
 * One line of annotation badges for a trace tree row, unfavorable results
 * first. Badges the row is too narrow for are clipped whole behind a "+N"
 * badge, which opens them in a popover, so a narrow tree still says how
 * many evals a span carries and shows the ones that flagged it.
 *
 * Renders nothing for a span with no summaries, so unannotated rows pay
 * nothing for it.
 */
export function SpanAnnotationBadges({
  summaries,
  annotationConfigsByName,
  className,
}: SpanAnnotationBadgesProps) {
  if (!summaries?.length) {
    return null;
  }
  const sortedSummaries = sortAnnotationSummariesForTriage(
    summaries,
    annotationConfigsByName
  );
  return (
    <div className={classNames("span-annotations", className)}>
      <OverflowRow size="S">
        {sortedSummaries.map((summary) => (
          <AnnotationSummaryBadge
            key={summary.name}
            summary={summary}
            annotationConfig={annotationConfigsByName.get(summary.name)}
          />
        ))}
      </OverflowRow>
    </div>
  );
}

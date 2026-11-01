import { OverflowRow } from "@phoenix/components";
import { AnnotationSummaryBadge } from "@phoenix/components/annotation/AnnotationSummaryBadge";
import { sortAnnotationSummariesForTriage } from "@phoenix/components/annotation/annotationSummaryUtils";
import type { AnnotationOptimizationConfig } from "@phoenix/components/annotation/optimizationUtils";
import type { AnnotationSummary } from "@phoenix/components/annotation/types";
import { classNames } from "@phoenix/utils/classNames";

export type SpanAnnotationBadgesProps = {
  summaries: readonly AnnotationSummary[] | null | undefined;
  annotationConfigsByName: ReadonlyMap<string, AnnotationOptimizationConfig>;
  className?: string;
};

/** Renders nothing without summaries, so unannotated rows add no layout. */
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

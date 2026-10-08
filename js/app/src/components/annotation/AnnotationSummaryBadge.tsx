import { css } from "@emotion/react";

import { outlinedPillCSS } from "@phoenix/components/core/styles";
import { truncateSingleCSS } from "@phoenix/components/core/utility/Truncate";

import { AnnotationColorSwatch } from "./AnnotationColorSwatch";
import { AnnotationLabelConsensusText } from "./AnnotationLabelConsensusText";
import { getAnnotationSummaryPositiveOptimization } from "./annotationSummaryUtils";
import { MeanScore } from "./MeanScore";
import type { AnnotationOptimizationConfig } from "./optimizationUtils";
import type { AnnotationSummary } from "./types";

const badgeCSS = css(
  outlinedPillCSS,
  css`
    display: inline-flex;
    align-items: center;
    gap: var(--global-dimension-size-75);
    box-sizing: border-box;
    height: var(--global-line-height-xs);
    /* A badge never shrinks, so an overflowing row clips whole badges behind
       its "+N" instead of truncating names */
    flex: none;
    max-width: 100%;
    padding: 0 var(--global-dimension-size-75);
    /* A tinted value fills the badge's end itself */
    &:has(.annotation-summary-badge__value [data-direction]) {
      padding-inline-end: 1px;
    }
    color: var(--global-text-color-700);
    font-size: var(--global-font-size-xs);
    line-height: 1;
    white-space: nowrap;

    .annotation-summary-badge__name {
      ${truncateSingleCSS}
      flex: 0 1 auto;
      min-width: 2ch;
    }
    .annotation-summary-badge__value {
      ${truncateSingleCSS}
      flex: none;
      max-width: 14ch;
    }
  `
);

export interface AnnotationSummaryBadgeProps {
  summary: AnnotationSummary;
  annotationConfig?: AnnotationOptimizationConfig;
}

/**
 * A summary's name and value: its mean score, which aggregates every
 * annotation behind it, or how far its labels agree when it has no score.
 */
export function AnnotationSummaryBadge({
  summary,
  annotationConfig,
}: AnnotationSummaryBadgeProps) {
  return (
    <span
      className="annotation-summary-badge"
      css={badgeCSS}
      title={summary.name}
    >
      <AnnotationColorSwatch annotationName={summary.name} size="S" />
      <span className="annotation-summary-badge__name">{summary.name}</span>
      {summary.meanScore != null ? (
        <MeanScore
          value={summary.meanScore}
          positiveOptimization={getAnnotationSummaryPositiveOptimization({
            summary,
            annotationConfig,
          })}
          size="XS"
          className="annotation-summary-badge__value"
        />
      ) : (
        <AnnotationLabelConsensusText
          summary={summary}
          size="XS"
          className="annotation-summary-badge__value"
        />
      )}
    </span>
  );
}

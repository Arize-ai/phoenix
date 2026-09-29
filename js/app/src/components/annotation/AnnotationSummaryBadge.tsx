import { css } from "@emotion/react";

import { outlinedPillCSS } from "@phoenix/components/core/styles";
import { truncateSingleCSS } from "@phoenix/components/core/utility/Truncate";
import { formatFloat } from "@phoenix/utils/numberFormatUtils";

import { AnnotationColorSwatch } from "./AnnotationColorSwatch";
import { AnnotationScoreText } from "./AnnotationScoreText";
import {
  getAnnotationSummaryPositiveOptimization,
  getAnnotationSummaryTopLabel,
} from "./annotationSummaryUtils";
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
    padding: 0 1px 0 var(--global-dimension-size-75);
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
    .annotation-summary-badge__value:not([data-direction]) {
      color: var(--global-text-color-900);
    }
  `
);

export interface AnnotationSummaryBadgeProps {
  summary: AnnotationSummary;
  annotationConfig?: AnnotationOptimizationConfig;
}

/** Shows the summary's most common label, falling back to its mean score. */
export function AnnotationSummaryBadge({
  summary,
  annotationConfig,
}: AnnotationSummaryBadgeProps) {
  const label = getAnnotationSummaryTopLabel(summary);
  const value =
    label ??
    (summary.meanScore != null ? formatFloat(summary.meanScore) : null);
  const title = value == null ? summary.name : `${summary.name}: ${value}`;
  return (
    <span className="annotation-summary-badge" css={badgeCSS} title={title}>
      <AnnotationColorSwatch annotationName={summary.name} size="S" />
      <span className="annotation-summary-badge__name">{summary.name}</span>
      {value != null ? (
        <AnnotationScoreText
          elementType="span"
          size="XS"
          fontFamily={label != null ? "default" : "mono"}
          className="annotation-summary-badge__value"
          positiveOptimization={getAnnotationSummaryPositiveOptimization({
            summary,
            annotationConfig,
          })}
        >
          {value}
        </AnnotationScoreText>
      ) : null}
    </span>
  );
}

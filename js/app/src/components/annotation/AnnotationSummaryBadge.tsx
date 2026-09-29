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
    /* Whole or not at all: in a row that runs out of room the badge moves
       behind the row's "+N" rather than squeezing its name to a fragment.
       Only a badge wider than the row itself truncates, to the row. */
    flex: none;
    max-width: 100%;
    /* The chip sits inside the pill's right end, one pixel from its edge */
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
  /**
   * The config for the summary's annotation name. Without one the badge has
   * no direction to judge by and its value stays plain.
   */
  annotationConfig?: AnnotationOptimizationConfig;
}

/**
 * The large annotation label at a size that fits one short line: a neutral
 * outlined pill with the annotation's word-color swatch and name, then its
 * most common label, or its mean score, in the tinted chip of
 * `AnnotationScoreText`. Only the chip carries the verdict, so a line of
 * these stays quiet and an unfavorable result stands out. Made for dense
 * surfaces such as trace tree rows.
 *
 * The pill is not interactive; put it inside a tooltip or popover trigger
 * when details are wanted.
 */
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

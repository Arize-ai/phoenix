import { css } from "@emotion/react";

import type { TextProps } from "@phoenix/components";
import { Text } from "@phoenix/components";
import { inlineDividerCSS } from "@phoenix/components/core/styles";
import { formatFloat } from "@phoenix/utils/numberFormatUtils";

import { AnnotationLabelConsensusText } from "./AnnotationLabelConsensusText";
import { AnnotationScoreText } from "./AnnotationScoreText";
import { getAnnotationLabelConsensus } from "./annotationSummaryUtils";
import type { AnnotationSummary } from "./types";

const valueCSS = css`
  display: inline-flex;
  min-width: 0;
  max-width: 100%;
  vertical-align: middle;

  .annotation-summary-value__chip {
    display: inline-flex;
    align-items: center;
    gap: var(--global-dimension-size-100);
    min-width: 0;
  }
  .annotation-summary-value__label {
    display: inline-flex;
    min-width: 0;
  }
  .annotation-summary-value__score {
    flex: none;
  }
`;

export type AnnotationSummaryValueProps = {
  summary: Pick<AnnotationSummary, "labelFractions" | "meanScore">;
  /**
   * Signed optimization value of the mean score, from -1 (worst) to 1
   * (best). Tints the whole value; leave it out for an untinted value.
   */
  optimizationValue?: number | null;
  size?: TextProps["size"];
  className?: string;
  /**
   * Rendered when the summary has neither labels nor a score.
   * @default "--"
   */
  fallback?: string;
};

/**
 * A summary's labels and mean score as one value, "correct 75% | μ 0.75",
 * tinted by the score: the summary counterpart of `AnnotationNameAndValue`'s
 * "score-and-label" display. Either part is left out when the summary has
 * none.
 */
export function AnnotationSummaryValue({
  summary,
  optimizationValue,
  size = "S",
  className,
  fallback = "--",
}: AnnotationSummaryValueProps) {
  const { meanScore } = summary;
  const hasLabels = getAnnotationLabelConsensus(summary) != null;
  const hasScore = typeof meanScore === "number" && !Number.isNaN(meanScore);
  if (!hasLabels && !hasScore) {
    return (
      <Text size={size} color="text-300" className={className}>
        {fallback}
      </Text>
    );
  }
  return (
    <span className={className} css={valueCSS}>
      <AnnotationScoreText
        elementType="span"
        size={size}
        optimizationValue={hasScore ? optimizationValue : null}
        className="annotation-summary-value__chip"
      >
        {hasLabels ? (
          <AnnotationLabelConsensusText
            summary={summary}
            size={size}
            color="inherit"
            className="annotation-summary-value__label"
          />
        ) : null}
        {hasLabels && hasScore ? (
          <span aria-hidden css={inlineDividerCSS} />
        ) : null}
        {hasScore ? (
          <Text
            size={size}
            fontFamily="mono"
            color="inherit"
            className="annotation-summary-value__score"
          >
            <span aria-label="mean score">μ</span>&nbsp;
            {formatFloat(meanScore)}
          </Text>
        ) : null}
      </AnnotationScoreText>
    </span>
  );
}

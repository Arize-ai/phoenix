import { css } from "@emotion/react";
import type { ReactNode } from "react";

import type { TextProps } from "@phoenix/components";
import { Text } from "@phoenix/components";
import { truncateSingleCSS } from "@phoenix/components/core/utility/Truncate";
import { formatPercentShort } from "@phoenix/utils/numberFormatUtils";

import { getAnnotationLabelConsensus } from "./annotationSummaryUtils";
import type { AnnotationSummary } from "./types";

const consensusCSS = css`
  display: inline-flex;
  align-items: baseline;
  gap: var(--global-dimension-size-50);
  min-width: 0;
  max-width: 100%;

  .annotation-label-consensus__label {
    ${truncateSingleCSS}
    min-width: 0;
  }
  .annotation-label-consensus__share {
    flex: none;
  }
`;

function formatShare(fraction: number) {
  return formatPercentShort(fraction * 100);
}

/**
 * How far a summary's labels agree: the label when all agree, the most common
 * label with its share when most do, and a muted "mixed" when labels tie.
 * Renders `fallback` without labels.
 */
export function AnnotationLabelConsensusText({
  summary,
  size = "S",
  className,
  fallback = null,
}: {
  summary: Pick<AnnotationSummary, "labelFractions">;
  size?: TextProps["size"];
  className?: string;
  /** Rendered when the summary has no labels. */
  fallback?: ReactNode;
}) {
  const consensus = getAnnotationLabelConsensus(summary);
  if (consensus == null) {
    return fallback;
  }
  if (consensus.kind === "mixed") {
    const breakdown = consensus.labelFractions
      .map((entry) => `${entry.label} ${formatShare(entry.fraction)}`)
      .join(", ");
    return (
      <Text
        size={size}
        color="text-500"
        className={className}
        title={`Mixed labels: ${breakdown}`}
      >
        mixed
      </Text>
    );
  }
  const share = consensus.fraction < 1 ? formatShare(consensus.fraction) : null;
  return (
    <Text
      size={size}
      className={className}
      title={
        share != null
          ? `${consensus.label} in ${share} of labels`
          : consensus.label
      }
    >
      <span css={consensusCSS}>
        <span className="annotation-label-consensus__label">
          {consensus.label}
        </span>
        {share != null ? (
          <Text
            size={size}
            color="text-500"
            fontFamily="mono"
            className="annotation-label-consensus__share"
          >
            {share}
          </Text>
        ) : null}
      </span>
    </Text>
  );
}

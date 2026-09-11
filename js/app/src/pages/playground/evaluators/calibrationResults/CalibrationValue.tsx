import { css } from "@emotion/react";

import { Text } from "@phoenix/components";
import { AnnotationScoreText } from "@phoenix/components/annotation";
import { inlineDividerCSS } from "@phoenix/components/core/styles";
import { Truncate } from "@phoenix/components/core/utility/Truncate";
import { floatFormatter } from "@phoenix/utils/numberFormatUtils";

const NO_VALUE = "—";

/**
 * A label · score pair in the annotation value style: the label in the body
 * font, the score in mono, a hairline divider between them.
 */
export function CalibrationValue({
  label,
  score,
  size,
}: {
  label?: string | null;
  score?: number | null;
  size?: "XS" | "S" | "M";
}) {
  const hasLabel = label != null && label !== "";
  const hasScore = score != null;

  if (!hasLabel && !hasScore)
    return (
      <Text size={size} color="text-500">
        {NO_VALUE}
      </Text>
    );

  return (
    <span css={valuePartsCSS}>
      {hasLabel ? (
        // The label gives way first when the column is narrow; the score is
        // short and reads wrong when clipped, so it keeps its width.
        <span className="value-parts__label">
          <Truncate maxWidth="100%" title={label}>
            <Text size={size}>{label}</Text>
          </Truncate>
        </span>
      ) : null}
      {hasLabel && hasScore ? (
        <span aria-hidden css={inlineDividerCSS} />
      ) : null}
      {hasScore ? (
        <AnnotationScoreText size={size} fontFamily="mono">
          {floatFormatter(score)}
        </AnnotationScoreText>
      ) : null}
    </span>
  );
}

const valuePartsCSS = css`
  display: inline-flex;
  align-items: center;
  gap: var(--global-dimension-size-100);
  min-width: 0;
  max-width: 100%;
  .value-parts__label {
    display: flex;
    min-width: 0;
    flex: 0 1 auto;
  }
  > :not(.value-parts__label) {
    flex: none;
  }
`;

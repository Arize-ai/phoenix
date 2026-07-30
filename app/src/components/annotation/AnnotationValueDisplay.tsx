import { css } from "@emotion/react";

import { Text } from "@phoenix/components";
import { formatAnnotationScore } from "@phoenix/components/annotation/annotationFormatUtils";
import { AnnotationScoreText } from "@phoenix/components/annotation/AnnotationScoreText";
import { classNames } from "@phoenix/utils/classNames";

const annotationValueDisplayCSS = css`
  display: flex;
  align-items: center;
  gap: var(--global-dimension-size-200);
  min-width: 0;
  white-space: nowrap;
`;

/** The score and label combination shared by annotation value surfaces. */
export function AnnotationValueDisplay({
  className,
  label,
  optimizationValue,
  score,
}: {
  className?: string;
  label?: string | null;
  optimizationValue?: number | null;
  score?: number | null;
}) {
  return (
    <div
      className={classNames("annotation-value-display", className)}
      css={annotationValueDisplayCSS}
    >
      {score != null ? (
        <AnnotationScoreText
          fontFamily="mono"
          optimizationValue={optimizationValue}
        >
          {formatAnnotationScore(score)}
        </AnnotationScoreText>
      ) : null}
      {label ? <Text>{label}</Text> : <Text color="text-500">--</Text>}
    </div>
  );
}

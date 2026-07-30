import { css } from "@emotion/react";

import { Text } from "@phoenix/components";
import type { Annotation } from "@phoenix/components/annotation/types";

/** A menu-only summary of the explanations behind an annotation value. */
export function AnnotationExplanationSummary({
  annotations,
}: {
  annotations: readonly Annotation[];
}) {
  const explanations = annotations
    .map((annotation) => annotation.explanation?.trim() || null)
    .filter((explanation): explanation is string => explanation != null);
  if (explanations.length === 0) {
    return null;
  }
  const explanation =
    annotations.length === 1 ? explanations[0] : "mixed explanations";
  return (
    <Text
      className="annotation-explanation-summary"
      color="text-500"
      size="XS"
      title={explanation}
      css={css`
        display: block;
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      `}
    >
      {explanation}
    </Text>
  );
}

import { CSSProperties } from "react";
import { css } from "@emotion/react";

import { Flex, Text } from "@phoenix/components";
import { TextSize } from "@phoenix/components/types";
import { assertUnreachable } from "@phoenix/typeUtils";
import { formatFloat } from "@phoenix/utils/numberFormatUtils";

import { AnnotationColorSwatch } from "./AnnotationColorSwatch";
import { AnnotationScoreText } from "./AnnotationScoreText";
import type { Annotation, AnnotationDisplayPreference } from "./types";

const textCSS = (maxWidth: CSSProperties["maxWidth"]) => css`
  display: flex;
  align-items: center;
  overflow: hidden;
  .ac-text {
    display: inline-block;
    max-width: ${maxWidth};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
`;

const getAnnotationDisplayValue = ({
  annotation,
  displayPreference,
}: {
  annotation: Annotation;
  displayPreference: AnnotationDisplayPreference;
}) => {
  switch (displayPreference) {
    case "label":
      return (
        annotation.label ||
        (typeof annotation.score == "number" &&
          formatFloat(annotation.score)) ||
        "n/a"
      );
    case "score":
      return (
        (typeof annotation.score == "number" &&
          formatFloat(annotation.score)) ||
        annotation.label ||
        "n/a"
      );
    case "none":
      return "";
    default:
      assertUnreachable(displayPreference);
  }
};

interface AnnotationNameAndValueProps {
  annotation: Annotation;
  displayPreference: AnnotationDisplayPreference;
  minWidth?: CSSProperties["minWidth"];
  maxWidth?: CSSProperties["maxWidth"];
  size?: TextSize;
  /**
   * Whether the annotation is a positive or negative optimization
   *
   * If not provided, the component will not display the optimization information.
   */
  positiveOptimization?: boolean;
  /**
   * Whether to show the color swatch next to the annotation name
   */
  showColorSwatch?: boolean;
}
export function AnnotationNameAndValue({
  annotation,
  displayPreference,
  size,
  minWidth = "5rem",
  maxWidth = "9rem",
  positiveOptimization,
  showColorSwatch = true,
}: AnnotationNameAndValueProps) {
  const labelValue = getAnnotationDisplayValue({
    annotation,
    displayPreference,
  });

  return (
    <Flex
      direction="row"
      gap="size-100"
      alignItems="center"
      className="annotation-name-and-value"
      maxWidth={maxWidth}
      minWidth={minWidth}
    >
      {showColorSwatch && (
        <AnnotationColorSwatch annotationName={annotation.name} />
      )}
      <div css={css(textCSS(maxWidth), { minWidth })} title={annotation.name}>
        <Text weight="heavy" size={size} color="inherit">
          {annotation.name}
        </Text>
      </div>
      {labelValue && (
        <div
          css={css(
            textCSS(maxWidth),
            css`
              margin-left: var(--ac-global-dimension-100);
            `
          )}
        >
          <AnnotationScoreText
            positiveOptimization={positiveOptimization}
            fontFamily="mono"
          >
            {labelValue}
          </AnnotationScoreText>
        </div>
      )}
    </Flex>
  );
}

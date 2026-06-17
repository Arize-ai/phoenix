import { css } from "@emotion/react";
import type { CSSProperties } from "react";

import { Flex, Text } from "@phoenix/components";
import type { TextSize } from "@phoenix/components/core/types";
import { assertUnreachable } from "@phoenix/typeUtils";
import { formatFloat } from "@phoenix/utils/numberFormatUtils";

import { AnnotationColorSwatch } from "./AnnotationColorSwatch";
import { AnnotationScoreText } from "./AnnotationScoreText";
import type { Annotation, AnnotationDisplayPreference } from "./types";

const textCSS = (maxWidth: CSSProperties["maxWidth"]) => css`
  display: flex;
  align-items: center;
  overflow: hidden;
  .text {
    display: inline-block;
    max-width: ${maxWidth};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
`;

/**
 * Derives the displayable score and label text for an annotation. Returns
 * `null` for a part that isn't present so callers can decide how to combine or
 * render them.
 */
const getAnnotationValueParts = (annotation: Annotation) => ({
  scoreText:
    typeof annotation.score === "number" ? formatFloat(annotation.score) : null,
  labelText: annotation.label || null,
});

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
    case "score-and-label": {
      // When both a label and a score are present, the combined value is
      // rendered as distinct pieces by the component. This branch only handles
      // the case where a single value is available.
      const { scoreText, labelText } = getAnnotationValueParts(annotation);
      return scoreText || labelText || "n/a";
    }
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
  const { scoreText, labelText } = getAnnotationValueParts(annotation);
  // When both a label and a score are shown, render them as distinct pieces:
  // the label in the default font and the score in mono, separated by clear
  // spacing — instead of wrapping the score in parentheses.
  const showsLabelAndScore =
    displayPreference === "score-and-label" &&
    scoreText != null &&
    labelText != null;

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
              margin-left: var(--global-dimension-100);
            `
          )}
        >
          <AnnotationScoreText
            positiveOptimization={positiveOptimization}
            fontFamily={showsLabelAndScore ? "default" : "mono"}
          >
            {showsLabelAndScore ? (
              <span
                css={css`
                  display: inline-flex;
                  align-items: center;
                  gap: var(--global-dimension-size-100);
                `}
              >
                <Text color="inherit" size={size}>
                  {labelText}
                </Text>
                <span
                  aria-hidden
                  css={css`
                    width: 1px;
                    height: 0.7em;
                    background-color: currentColor;
                    opacity: 0.2;
                  `}
                />
                <Text fontFamily="mono" color="inherit" size={size}>
                  {scoreText}
                </Text>
              </span>
            ) : (
              labelValue
            )}
          </AnnotationScoreText>
        </div>
      )}
    </Flex>
  );
}

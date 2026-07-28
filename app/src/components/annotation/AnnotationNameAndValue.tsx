import { css } from "@emotion/react";
import { Fragment } from "react";
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

const valuePartsCSS = css`
  display: inline-flex;
  align-items: center;
  gap: var(--global-dimension-size-100);
`;

// A thin separator between value pieces (e.g. a label and its score). Tinted
// with the current text color so it inherits the optimization-direction color.
const valueDividerCSS = css`
  width: 1px;
  height: 0.7em;
  background-color: currentColor;
  opacity: 0.2;
`;

/**
 * A single renderable piece of an annotation value. Scores render in a
 * monospace font; labels render in the default font.
 */
type AnnotationValuePart = {
  text: string;
  fontFamily: "mono" | "default";
};

/**
 * Resolves an annotation into the ordered value pieces to render for the given
 * display preference. Returns an empty array when nothing should be shown (the
 * "none" preference) and a single "n/a" piece when a value is expected but
 * absent. The component renders every preference through these parts, so a
 * score always shows in mono and a label in the default font.
 */
const getAnnotationValueParts = (
  annotation: Annotation,
  displayPreference: AnnotationDisplayPreference
): AnnotationValuePart[] => {
  const scorePart: AnnotationValuePart | null =
    typeof annotation.score === "number"
      ? { text: formatFloat(annotation.score), fontFamily: "mono" }
      : null;
  const labelPart: AnnotationValuePart | null = annotation.label
    ? { text: annotation.label, fontFamily: "default" }
    : null;

  const withFallback = (
    parts: (AnnotationValuePart | null)[]
  ): AnnotationValuePart[] => {
    const present = parts.filter(
      (part): part is AnnotationValuePart => part != null
    );
    return present.length > 0
      ? present
      : [{ text: "n/a", fontFamily: "default" }];
  };

  switch (displayPreference) {
    case "none":
      return [];
    case "label":
      return withFallback([labelPart ?? scorePart]);
    case "score":
      return withFallback([scorePart ?? labelPart]);
    case "score-and-label":
      return withFallback([labelPart, scorePart]);
    default:
      return assertUnreachable(displayPreference);
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
  const valueParts = getAnnotationValueParts(annotation, displayPreference);

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
      {valueParts.length > 0 && (
        <div
          css={css(
            textCSS(maxWidth),
            css`
              margin-left: var(--global-dimension-100);
            `
          )}
        >
          <AnnotationScoreText positiveOptimization={positiveOptimization}>
            <span css={valuePartsCSS}>
              {valueParts.map((part, index) => (
                <Fragment key={index}>
                  {index > 0 && <span aria-hidden css={valueDividerCSS} />}
                  <Text
                    fontFamily={part.fontFamily}
                    color="inherit"
                    size={size}
                  >
                    {part.text}
                  </Text>
                </Fragment>
              ))}
            </span>
          </AnnotationScoreText>
        </div>
      )}
    </Flex>
  );
}

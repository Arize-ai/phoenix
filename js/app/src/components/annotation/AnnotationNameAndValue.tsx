import { css } from "@emotion/react";
import { Fragment } from "react";
import type { CSSProperties } from "react";

import { Flex, Text } from "@phoenix/components";
import { inlineDividerCSS } from "@phoenix/components/core/styles";
import type { TextSize } from "@phoenix/components/core/types";
import { assertUnreachable } from "@phoenix/typeUtils";
import { formatFloat } from "@phoenix/utils/numberFormatUtils";

import { AnnotationColorSwatch } from "./AnnotationColorSwatch";
import { AnnotationScoreText } from "./AnnotationScoreText";
import { isRefusedDecisionAnnotation } from "./decisionAnnotation";
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
 * When the name gives way first: the name shrinks to an ellipsis and the
 * value keeps its full width, so a long name never clips the score.
 */
const nameGivesWayCSS = css`
  flex: 0 1 auto;
  min-width: 0;
  .text {
    max-width: 100%;
  }
`;

const valueKeepsWidthCSS = css`
  flex: none;
`;

const valuePartsCSS = css`
  display: inline-flex;
  align-items: center;
  gap: var(--global-dimension-size-100);
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

  const isRefused = isRefusedDecisionAnnotation(annotation);
  const withFallback = (
    parts: (AnnotationValuePart | null)[]
  ): AnnotationValuePart[] => {
    const present = parts.filter(
      (part): part is AnnotationValuePart => part != null
    );
    return present.length > 0
      ? present
      : [{ text: isRefused ? "Refused" : "n/a", fontFamily: "default" }];
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
   * Signed optimization value from -1 (worst) to 1 (best) that colors the
   * value. If not provided, the value is not colored.
   */
  optimizationValue?: number | null;
  /**
   * Whether to show the color swatch next to the annotation name
   */
  showColorSwatch?: boolean;
  /**
   * Truncate the name before the value when space runs out, so the label and
   * score always show in full. Off by default: both shrink together.
   */
  truncateNameFirst?: boolean;
  /**
   * The name to show in place of the annotation's own; null shows no name.
   * The title tooltip keeps the annotation's full name either way.
   */
  displayName?: string | null;
}
export function AnnotationNameAndValue({
  annotation,
  displayPreference,
  size,
  minWidth = "5rem",
  maxWidth = "9rem",
  optimizationValue,
  showColorSwatch = true,
  truncateNameFirst = false,
  displayName,
}: AnnotationNameAndValueProps) {
  const valueParts = getAnnotationValueParts(annotation, displayPreference);
  const name = displayName === undefined ? annotation.name : displayName;

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
      {name ? (
        <div
          css={css(
            textCSS(maxWidth),
            { minWidth },
            truncateNameFirst && nameGivesWayCSS
          )}
          title={annotation.name}
        >
          <Text weight="heavy" size={size} color="inherit">
            {name}
          </Text>
        </div>
      ) : null}
      {valueParts.length > 0 && (
        <div
          css={css(
            textCSS(maxWidth),
            css`
              margin-left: var(--global-dimension-100);
            `,
            truncateNameFirst && valueKeepsWidthCSS
          )}
        >
          <AnnotationScoreText
            optimizationValue={optimizationValue}
            size={size}
          >
            <span css={valuePartsCSS}>
              {valueParts.map((part, index) => (
                <Fragment key={index}>
                  {index > 0 && <span aria-hidden css={inlineDividerCSS} />}
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

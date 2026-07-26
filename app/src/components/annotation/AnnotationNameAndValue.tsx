import { css } from "@emotion/react";
import { Fragment } from "react";
import type { CSSProperties } from "react";

import { Flex, Text } from "@phoenix/components";
import type { TextColorValue, TextSize } from "@phoenix/components/core/types";
import { assertUnreachable } from "@phoenix/typeUtils";
import { formatFloat } from "@phoenix/utils/numberFormatUtils";

import { AnnotationColorSwatch } from "./AnnotationColorSwatch";
import { AnnotationScoreText } from "./AnnotationScoreText";
import type { Annotation, AnnotationDisplayPreference } from "./types";

const nameCSS = (maxWidth: CSSProperties["maxWidth"]) => css`
  display: flex;
  align-items: center;
  flex: 0 1 auto;
  min-width: 0;
  max-width: ${maxWidth};
  > .text {
    display: inline-block;
    max-width: 100%;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
`;

const valueCSS = (maxWidth: CSSProperties["maxWidth"]) => css`
  display: flex;
  align-items: center;
  flex: 0 3 auto;
  min-width: 0;
  max-width: ${maxWidth};
  overflow: hidden;
  > .text {
    box-sizing: border-box;
    display: flex;
    min-width: 0;
    max-width: 100%;
    overflow: hidden;
  }
`;

const nameAndValueCSS = css`
  overflow: hidden;
`;

const valuePartsCSS = css`
  display: flex;
  align-items: center;
  gap: var(--global-dimension-size-100);
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  > .text {
    flex: 0 1 auto;
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  > [data-value-kind="score"] {
    flex: none;
  }
`;

// A thin separator between value pieces (e.g. a label and its score). Tinted
// with the current text color so it inherits the optimization-direction color.
const valueDividerCSS = css`
  flex: none;
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
  kind: "label" | "score" | "fallback";
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
      ? {
          kind: "score",
          text: formatFloat(annotation.score),
          fontFamily: "mono",
        }
      : null;
  const labelPart: AnnotationValuePart | null = annotation.label
    ? { kind: "label", text: annotation.label, fontFamily: "default" }
    : null;

  const withFallback = (
    parts: (AnnotationValuePart | null)[]
  ): AnnotationValuePart[] => {
    const present = parts.filter(
      (part): part is AnnotationValuePart => part != null
    );
    return present.length > 0
      ? present
      : [{ kind: "fallback", text: "n/a", fontFamily: "default" }];
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
  /**
   * Optional minimum width for the annotation name. This can align values in
   * vertically stacked layouts; inline layouts should use the default of zero.
   */
  minWidth?: CSSProperties["minWidth"];
  maxWidth?: CSSProperties["maxWidth"];
  size?: TextSize;
  /** The annotation name color. */
  nameColor?: TextColorValue;
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
  minWidth = 0,
  maxWidth = "9rem",
  nameColor = "text-700",
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
      width="fit-content"
      maxWidth="100%"
      minWidth={0}
      css={nameAndValueCSS}
    >
      {showColorSwatch && (
        <AnnotationColorSwatch annotationName={annotation.name} />
      )}
      <div css={css(nameCSS(maxWidth), { minWidth })} title={annotation.name}>
        <Text size={size} color={nameColor}>
          {annotation.name}
        </Text>
      </div>
      {valueParts.length > 0 && (
        <div css={valueCSS(maxWidth)}>
          <AnnotationScoreText positiveOptimization={positiveOptimization}>
            <span css={valuePartsCSS}>
              {valueParts.map((part, index) => (
                <Fragment key={index}>
                  {index > 0 && <span aria-hidden css={valueDividerCSS} />}
                  <Text
                    data-value-kind={part.kind}
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

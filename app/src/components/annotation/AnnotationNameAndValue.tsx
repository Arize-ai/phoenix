import { CSSProperties } from "react";
import { css } from "@emotion/react";

import { Flex, Text } from "@phoenix/components";
import { TextSize } from "@phoenix/components/types";
import { assertUnreachable } from "@phoenix/typeUtils";
import { formatFloat } from "@phoenix/utils/numberFormatUtils";

import { AnnotationColorSwatch } from "./AnnotationColorSwatch";
import { OptimizedValueText } from "./OptimizedValueText";
import { ProportionBar } from "./ProportionBar";
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

/**
 * CSS for the proportion bar wrapper.
 * Uses a container query to hide the bar when the nearest ancestor
 * with container-type is too narrow.
 *
 * Note: The parent component (e.g., the cell) should set container-type: inline-size
 * for this to work. If no container ancestor exists, the bar will always be visible.
 */
const proportionBarWrapperCSS = css`
  display: flex;
  align-items: center;
  width: 60px;
  flex-shrink: 0;

  @container (max-width: 250px) {
    display: none;
  }
`;

type ProportionBarProps = {
  score?: number | null;
  lowerBound?: number | null;
  upperBound?: number | null;
  optimizationDirection?: "MAXIMIZE" | "MINIMIZE";
};

interface AnnotationNameAndValueProps extends ProportionBarProps {
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
   * Whether to show the proportion bar next to the score
   */
  showProportionBar?: boolean;
}
export function AnnotationNameAndValue({
  annotation,
  displayPreference,
  size,
  minWidth = "5rem",
  maxWidth = "9rem",
  positiveOptimization,
  score,
  lowerBound,
  upperBound,
  optimizationDirection,
  showProportionBar,
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
      <AnnotationColorSwatch annotationName={annotation.name} />
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
          <OptimizedValueText
            positiveOptimization={positiveOptimization}
            fontFamily="mono"
          >
            {labelValue}
          </OptimizedValueText>
        </div>
      )}
      {showProportionBar && (
        <div css={proportionBarWrapperCSS}>
          <ProportionBar
            score={score}
            lowerBound={lowerBound}
            upperBound={upperBound}
            optimizationDirection={optimizationDirection}
          />
        </div>
      )}
    </Flex>
  );
}

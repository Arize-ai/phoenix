import { ReactNode } from "react";
import { css } from "@emotion/react";

import { Text, TextProps } from "@phoenix/components";

type AnnotationScoreTextProps = Omit<TextProps, "children" | "color"> & {
  /**
   * Whether the value represents a positive optimization result.
   * - true: renders in green (success color)
   * - false: renders in red (failure color)
   * - undefined/null: renders with inherited color
   */
  positiveOptimization?: boolean | null;
  children: ReactNode;
};

const directionCSS = css`
  // only apply padding and border radius if there is a direction
  &[data-direction] {
    padding: var(--ac-global-dimension-size-25)
      var(--ac-global-dimension-size-100);
    border-radius: var(--ac-global-rounding-small);
  }
  &[data-direction="positive"] {
    color: var(--ac-global-color-optimization-direction-positive);
    background-color: var(
      --ac-global-color-background-optimization-direction-positive
    );
  }
  &[data-direction="negative"] {
    color: var(--ac-global-color-optimization-direction-negative);
    background-color: var(
      --ac-global-color-background-optimization-direction-negative
    );
  }
`;

/**
 * A Text component that colors its content based on optimization direction.
 *
 * Green for positive optimization (score above midpoint for MAXIMIZE, below for MINIMIZE).
 * Red for negative optimization.
 * Inherited color if optimization status cannot be determined.
 *
 * @example
 * ```tsx
 * <AnnotationScoreText positiveOptimization={true} fontFamily="mono">
 *   0.95
 * </AnnotationScoreText>
 * ```
 */
export function AnnotationScoreText({
  positiveOptimization,
  children,
  ...textProps
}: AnnotationScoreTextProps) {
  const direction =
    positiveOptimization === true
      ? "positive"
      : positiveOptimization === false
        ? "negative"
        : undefined;

  return (
    <Text {...textProps} data-direction={direction} css={directionCSS}>
      {children}
    </Text>
  );
}

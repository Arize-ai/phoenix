import { css } from "@emotion/react";
import type { ReactNode } from "react";

import type { TextProps } from "@phoenix/components";
import { Text, VisuallyHidden } from "@phoenix/components";

type AnnotationScoreTextProps = Omit<TextProps, "children" | "color"> & {
  /**
   * Whether the value represents a positive optimization result.
   * - true: renders in green (success color)
   * - false: renders in red (failure color)
   * - undefined/null: renders with inherited color
   */
  positiveOptimization?: boolean | null;
  /**
   * `compact` trims the tinted chip to fit inside a one-line pill.
   * @default "default"
   */
  density?: "default" | "compact";
  /**
   * Keeps the chip's inset without a direction, so plain values line up with
   * tinted ones in a column.
   * @default false
   */
  reserveInset?: boolean;
  children: ReactNode;
};

const directionCSS = css`
  // only apply padding and border radius if there is a direction, unless
  // the caller reserves the inset to keep a column aligned
  &[data-direction],
  &[data-reserve-inset] {
    padding: var(--global-dimension-size-25) var(--global-dimension-size-100);
    border-radius: var(--global-rounding-small);
  }
  &[data-density="compact"] {
    padding: 0 var(--global-dimension-size-50);
    border-radius: var(--global-rounding-xsmall);
    line-height: calc(var(--global-line-height-xs) - 4px);
  }
  &[data-direction="positive"] {
    color: var(--global-color-optimization-direction-positive);
    background-color: var(
      --global-color-background-optimization-direction-positive
    );
  }
  &[data-direction="negative"] {
    color: var(--global-color-optimization-direction-negative);
    background-color: var(
      --global-color-background-optimization-direction-negative
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
  density = "default",
  reserveInset = false,
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
    <Text
      {...textProps}
      data-direction={direction}
      data-density={density}
      data-reserve-inset={reserveInset || undefined}
      css={directionCSS}
    >
      {direction && (
        <VisuallyHidden>
          {direction === "positive"
            ? "Favorable score: "
            : "Unfavorable score: "}
        </VisuallyHidden>
      )}
      {children}
    </Text>
  );
}

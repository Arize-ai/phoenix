import { css } from "@emotion/react";
import type { ReactNode } from "react";

import type { TextProps } from "@phoenix/components";
import { Text, VisuallyHidden } from "@phoenix/components";

type AnnotationScoreTextProps = Omit<TextProps, "children" | "color"> & {
  /**
   * Signed optimization value from -1 (worst) through 0 (neutral) to 1
   * (best), as returned by `getOptimizationValue`. The semantic color scales
   * with its magnitude. When null or undefined, the text inherits its color.
   */
  optimizationValue?: number | null;
  children: ReactNode;
};

type OptimizationDirection = "positive" | "negative" | "neutral";

const directionCSS = css`
  // only apply padding and border radius if there is a direction
  &[data-direction] {
    padding: var(--global-dimension-size-25) var(--global-dimension-size-100);
    border-radius: var(--global-rounding-small);
  }
  // XS values sit inside one-line badges
  &[data-direction][data-size="XS"] {
    padding: 0 var(--global-dimension-size-50);
    border-radius: var(--global-rounding-xsmall);
    line-height: calc(var(--global-line-height-xs) - 4px);
  }
  &[data-direction="positive"] {
    color: color-mix(
      in srgb,
      var(--global-text-color-700),
      var(--global-color-optimization-direction-positive)
        var(--annotation-score-strength, 100%)
    );
    background-color: color-mix(
      in srgb,
      transparent,
      var(--global-color-background-optimization-direction-positive)
        var(--annotation-score-strength, 100%)
    );
  }
  &[data-direction="negative"] {
    color: color-mix(
      in srgb,
      var(--global-text-color-700),
      var(--global-color-optimization-direction-negative)
        var(--annotation-score-strength, 100%)
    );
    background-color: color-mix(
      in srgb,
      transparent,
      var(--global-color-background-optimization-direction-negative)
        var(--annotation-score-strength, 100%)
    );
  }
  &[data-direction="neutral"] {
    color: var(--global-text-color-700);
  }
`;

// Rounded to whole percents so the generated classes stay a small fixed set.
const strengthCSS = (strengthPercent: number) => css`
  --annotation-score-strength: ${strengthPercent}%;
`;

const VISUALLY_HIDDEN_PREFIX: Record<OptimizationDirection, string> = {
  positive: "Favorable score: ",
  negative: "Unfavorable score: ",
  neutral: "Neutral score: ",
};

function getDirection(optimizationValue: number): OptimizationDirection {
  return optimizationValue > 0
    ? "positive"
    : optimizationValue < 0
      ? "negative"
      : "neutral";
}

/**
 * A Text component that colors its content based on optimization direction.
 *
 * Green for a favorable score, red for an unfavorable one, and inherited
 * color when there is no optimization value. The color scales with distance
 * from the pivot: a score at the pivot is neutral, and the full semantic
 * color is reached at the best or worst bound.
 *
 * @example
 * ```tsx
 * <AnnotationScoreText optimizationValue={0.6} fontFamily="mono">
 *   0.80
 * </AnnotationScoreText>
 * ```
 */
export function AnnotationScoreText({
  optimizationValue,
  children,
  ...textProps
}: AnnotationScoreTextProps) {
  const normalizedOptimizationValue =
    optimizationValue != null && Number.isFinite(optimizationValue)
      ? Math.max(-1, Math.min(1, optimizationValue))
      : null;
  const direction =
    normalizedOptimizationValue != null
      ? getDirection(normalizedOptimizationValue)
      : undefined;

  return (
    <Text
      {...textProps}
      data-direction={direction}
      css={css(
        directionCSS,
        normalizedOptimizationValue != null &&
          strengthCSS(Math.round(Math.abs(normalizedOptimizationValue) * 100))
      )}
    >
      {direction && (
        <VisuallyHidden>{VISUALLY_HIDDEN_PREFIX[direction]}</VisuallyHidden>
      )}
      {children}
    </Text>
  );
}

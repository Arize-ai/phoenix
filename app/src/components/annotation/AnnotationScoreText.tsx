import { css } from "@emotion/react";
import type { ReactNode } from "react";

import type { TextProps } from "@phoenix/components";
import { Text } from "@phoenix/components";

type AnnotationScoreTextProps = Omit<TextProps, "children" | "color"> & {
  /** Whether to render the semantic color as a badge, compact inset, or text only. */
  appearance?: "badge" | "compact" | "text";
  /**
   * Whether the value represents a positive optimization result.
   * - true: renders in green (success color)
   * - false: renders in red (failure color)
   * - undefined/null: renders with inherited color
   */
  positiveOptimization?: boolean | null;
  /**
   * Signed normalized optimization value from -1 (worst) through 0 (neutral)
   * to 1 (best). When provided, this takes precedence over
   * `positiveOptimization` and renders a continuous semantic color treatment.
   */
  optimizationValue?: number | null;
  children: ReactNode;
};

const directionCSS = css`
  &[data-direction="positive"] {
    color: var(
      --annotation-score-foreground-color,
      var(--global-color-optimization-direction-positive)
    );
  }
  &[data-direction="negative"] {
    color: var(
      --annotation-score-foreground-color,
      var(--global-color-optimization-direction-negative)
    );
  }
  &[data-direction="neutral"] {
    color: var(
      --annotation-score-foreground-color,
      var(--global-text-color-700)
    );
  }
`;

const semanticBackgroundCSS = css`
  &[data-direction="positive"] {
    background-color: var(
      --annotation-score-background-color,
      var(--global-color-background-optimization-direction-positive)
    );
  }
  &[data-direction="negative"] {
    background-color: var(
      --annotation-score-background-color,
      var(--global-color-background-optimization-direction-negative)
    );
  }
  &[data-direction="neutral"] {
    background-color: var(--annotation-score-background-color, transparent);
  }
`;

const badgeCSS = css`
  &[data-direction] {
    padding: var(--global-dimension-size-25) var(--global-dimension-size-100);
    border-radius: var(--global-rounding-small);
  }
`;

const compactCSS = css`
  padding: 0 var(--global-dimension-size-50);
  border-radius: var(--global-rounding-xsmall);
`;

function getOptimizationGradientCSS(optimizationValue: number) {
  const strength = Math.abs(optimizationValue) * 100;
  const foregroundColor =
    optimizationValue >= 0
      ? "var(--global-color-optimization-direction-positive)"
      : "var(--global-color-optimization-direction-negative)";
  const backgroundColor =
    optimizationValue >= 0
      ? "var(--global-color-background-optimization-direction-positive)"
      : "var(--global-color-background-optimization-direction-negative)";
  return css`
    --annotation-score-foreground-color: color-mix(
      in srgb,
      var(--global-text-color-700),
      ${foregroundColor} ${strength}%
    );
    --annotation-score-background-color: color-mix(
      in srgb,
      transparent,
      ${backgroundColor} ${strength}%
    );
  `;
}

/**
 * A Text component that colors its content based on optimization direction.
 *
 * A signed optimization value renders continuously from semantic red through
 * neutral to semantic green. The boolean API retains the endpoint treatment
 * for callers that only know positive versus negative.
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
  appearance = "badge",
  positiveOptimization,
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
      ? normalizedOptimizationValue > 0
        ? "positive"
        : normalizedOptimizationValue < 0
          ? "negative"
          : "neutral"
      : positiveOptimization === true
        ? "positive"
        : positiveOptimization === false
          ? "negative"
          : undefined;
  const appearanceCSS =
    appearance === "badge"
      ? badgeCSS
      : appearance === "compact"
        ? compactCSS
        : undefined;
  const hasSemanticBackground = appearance !== "text";
  const scoreCSS =
    normalizedOptimizationValue == null
      ? css(
          directionCSS,
          hasSemanticBackground && semanticBackgroundCSS,
          appearanceCSS
        )
      : css(
          directionCSS,
          hasSemanticBackground && semanticBackgroundCSS,
          appearanceCSS,
          getOptimizationGradientCSS(normalizedOptimizationValue)
        );

  return (
    <Text
      {...textProps}
      data-appearance={appearance}
      data-direction={direction}
      data-optimization-value={normalizedOptimizationValue ?? undefined}
      css={scoreCSS}
    >
      {children}
    </Text>
  );
}

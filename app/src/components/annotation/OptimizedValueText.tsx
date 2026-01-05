import { ReactNode } from "react";
import { css } from "@emotion/react";

import { Text, TextProps } from "@phoenix/components";

type OptimizedValueTextProps = Omit<TextProps, "children" | "color"> & {
  /**
   * Whether the value represents a positive optimization result.
   * - true: renders in green (success color)
   * - false: renders in red (failure color)
   * - undefined/null: renders with inherited color
   */
  positiveOptimization?: boolean | null;
  children: ReactNode;
};

const positiveOptimizationCSS = css`
  color: var(--ac-global-color-optimization-direction-positive);
`;

const negativeOptimizationCSS = css`
  color: var(--ac-global-color-optimization-direction-negative);
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
 * <OptimizedValueText positiveOptimization={true} fontFamily="mono">
 *   0.95
 * </OptimizedValueText>
 * ```
 */
export function OptimizedValueText({
  positiveOptimization,
  children,
  ...textProps
}: OptimizedValueTextProps) {
  const colorCSS =
    positiveOptimization === true
      ? positiveOptimizationCSS
      : positiveOptimization === false
        ? negativeOptimizationCSS
        : undefined;

  return (
    <Text {...textProps} css={colorCSS}>
      {children}
    </Text>
  );
}

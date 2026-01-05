import { css } from "@emotion/react";

const proportionBarContainerCSS = css`
  width: 100%;
  height: 4px;
  background: var(--ac-global-color-grey-300);
  border-radius: 2px;
  overflow: hidden;
`;

const proportionBarFillCSS = css`
  height: 100%;
  border-radius: 2px;
  transition: width 0.2s ease-in-out;
`;

/**
 * Calculates the fill percentage for the proportion bar.
 * Clamps the value between 0 and 100.
 */
function calculateFillPercentage(
  score: number,
  lowerBound: number,
  upperBound: number
): number {
  if (upperBound === lowerBound) {
    return 100;
  }
  const percentage = ((score - lowerBound) / (upperBound - lowerBound)) * 100;
  return Math.max(0, Math.min(100, percentage));
}

/**
 * Determines the color of the proportion bar fill.
 * - At upper bound with MAXIMIZE: green
 * - At lower bound with MINIMIZE: green
 * - At lower bound with MAXIMIZE: red
 * - At upper bound with MINIMIZE: red
 * - Otherwise: primary color
 */
function getProportionBarColor(
  score: number,
  lowerBound: number,
  upperBound: number,
  optimizationDirection?: "MAXIMIZE" | "MINIMIZE"
): string {
  const isAtUpperBound = score >= upperBound;
  const isAtLowerBound = score <= lowerBound;

  if (optimizationDirection === "MAXIMIZE") {
    if (isAtUpperBound) {
      return "var(--ac-global-color-green-500)";
    }
    if (isAtLowerBound) {
      return "var(--ac-global-color-red-500)";
    }
  } else if (optimizationDirection === "MINIMIZE") {
    if (isAtLowerBound) {
      return "var(--ac-global-color-green-500)";
    }
    if (isAtUpperBound) {
      return "var(--ac-global-color-red-500)";
    }
  }

  return "var(--ac-global-color-primary)";
}

export type ProportionBarProps = {
  /**
   * The score value used to calculate the proportion bar fill.
   */
  score: number | null | undefined;
  /**
   * The lower bound for the proportion calculation.
   */
  lowerBound: number | null | undefined;
  /**
   * The upper bound for the proportion calculation.
   */
  upperBound: number | null | undefined;
  /**
   * The optimization direction. Used to determine bar color at boundaries.
   */
  optimizationDirection?: "MAXIMIZE" | "MINIMIZE";
};

/**
 * A proportion bar that visualizes where a score falls between bounds.
 *
 * The bar fills based on the score's position between lower and upper bounds.
 * Color changes at the boundaries based on optimization direction:
 * - Green at optimal bound (upper for MAXIMIZE, lower for MINIMIZE)
 * - Red at non-optimal bound
 * - Primary color otherwise
 *
 * Returns null if required props are missing.
 *
 * @example
 * ```tsx
 * <ProportionBar
 *   score={0.7}
 *   lowerBound={0}
 *   upperBound={1}
 *   optimizationDirection="MAXIMIZE"
 * />
 * ```
 */
export function ProportionBar({
  score,
  lowerBound,
  upperBound,
  optimizationDirection,
}: ProportionBarProps) {
  if (score == null || lowerBound == null || upperBound == null) {
    return null;
  }

  const fillPercentage = calculateFillPercentage(score, lowerBound, upperBound);
  const fillColor = getProportionBarColor(
    score,
    lowerBound,
    upperBound,
    optimizationDirection
  );

  return (
    <div css={proportionBarContainerCSS}>
      <div
        css={proportionBarFillCSS}
        style={{
          width: `${fillPercentage}%`,
          backgroundColor: fillColor,
        }}
      />
    </div>
  );
}

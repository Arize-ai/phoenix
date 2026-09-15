import { css } from "@emotion/react";
import type { ReactNode } from "react";

import { Icon, Icons, Text } from "@phoenix/components";
import type { EvaluatorOptimizationDirection } from "@phoenix/types";

const OPTIMIZATION_DIRECTION_LABELS = {
  MAXIMIZE: "Maximize",
  MINIMIZE: "Minimize",
  NONE: "Neutral",
} satisfies Record<EvaluatorOptimizationDirection, string>;

const OPTIMIZATION_DIRECTION_ICONS = {
  MAXIMIZE: <Icons.ArrowUp />,
  MINIMIZE: <Icons.ArrowDown />,
  NONE: <Icons.Minus />,
} satisfies Record<EvaluatorOptimizationDirection, ReactNode>;

const optimizationDirectionIndicatorCSS = css`
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: var(--global-dimension-size-50);
  white-space: nowrap;

  .optimization-direction-indicator__icon {
    color: var(--global-text-color-400);
    font-size: var(--global-font-size-s);
  }
`;

/**
 * Displays whether higher scores, lower scores, or a neutral direction is preferred.
 */
export function OptimizationDirectionIndicator({
  optimizationDirection,
}: {
  optimizationDirection: EvaluatorOptimizationDirection;
}) {
  const icon = OPTIMIZATION_DIRECTION_ICONS[optimizationDirection];
  return (
    <span
      className="optimization-direction-indicator"
      data-direction={optimizationDirection}
      css={optimizationDirectionIndicatorCSS}
    >
      <Text size="S" color="text-700">
        {OPTIMIZATION_DIRECTION_LABELS[optimizationDirection]}
      </Text>
      <Icon
        className="optimization-direction-indicator__icon"
        svg={icon}
        aria-hidden="true"
      />
    </span>
  );
}

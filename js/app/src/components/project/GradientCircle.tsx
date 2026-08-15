import { css } from "@emotion/react";

export interface GradientCircleProps {
  gradientStartColor: string;
  gradientEndColor: string;
  size?: number;
}

export function GradientCircle({
  gradientStartColor,
  gradientEndColor,
  size = 32,
}: GradientCircleProps) {
  return (
    <div
      css={css`
        border-radius: 50%;
        width: ${size}px;
        height: ${size}px;
        background: linear-gradient(
          136.27deg,
          ${gradientStartColor} 14.03%,
          ${gradientEndColor} 84.38%
        );
        flex-shrink: 0;
      `}
    />
  );
}

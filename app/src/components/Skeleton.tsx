import React from "react";
import { css } from "@emotion/react";

import { ComponentSize } from "./types/sizing";

type BorderRadiusToken = ComponentSize | "none" | "circle";

type SkeletonProps = {
  /**
   * Width of the skeleton. Can be a number (px) or string value
   */
  width?: number | string;
  /**
   * Height of the skeleton. Can be a number (px) or string value
   */
  height?: number | string;
  /**
   * Border radius of the skeleton. Can be:
   * - number (converted to px)
   * - string (used as-is)
   * - design token ('none' | 'S' | 'M' | 'L' | 'circle')
   * @default 'M'
   */
  borderRadius?: number | string | BorderRadiusToken;
  /**
   * Optional className for custom styling
   */
  className?: string;
};

const pulseKeyframes = css`
  @keyframes pulse {
    0% {
      opacity: 1;
    }
    50% {
      opacity: 0.4;
    }
    100% {
      opacity: 1;
    }
  }
`;

const skeletonStyles = css`
  ${pulseKeyframes}
  display: block;
  background-color: var(--ac-global-color-grey-300);
  animation: pulse 2s ease-in-out 0.5s infinite;
`;

const getBorderRadius = (radius: SkeletonProps["borderRadius"]) => {
  if (typeof radius === "number") {
    return `${radius}px`;
  }

  if (typeof radius === "string") {
    switch (radius) {
      case "none":
        return "0";
      case "S":
        return "var(--ac-global-rounding-small)";
      case "M":
        return "var(--ac-global-rounding-medium)";
      case "L":
        return "var(--ac-global-rounding-large)";
      case "circle":
        return "50%";
      default:
        return radius;
    }
  }

  return "var(--ac-global-rounding-medium)";
};

export function Skeleton({
  width = "100%",
  height = "1.2em",
  borderRadius = "M",
  className,
}: SkeletonProps) {
  const finalWidth = typeof width === "number" ? `${width}px` : width;
  const finalHeight = typeof height === "number" ? `${height}px` : height;
  const finalRadius = getBorderRadius(borderRadius);

  return (
    <span
      className={className}
      css={[
        skeletonStyles,
        css`
          width: ${finalWidth};
          height: ${finalHeight};
          border-radius: ${finalRadius};
        `,
      ]}
    />
  );
}

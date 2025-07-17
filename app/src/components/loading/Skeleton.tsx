import { forwardRef, HTMLAttributes } from "react";
import { css, keyframes } from "@emotion/react";

import { classNames } from "@arizeai/components";

import { BorderRadiusToken } from "../types/sizing";

// Export the AnimationType so it can be used in stories
export type AnimationType = "pulse" | "wave" | false;

export interface SkeletonProps extends HTMLAttributes<HTMLSpanElement> {
  /**
   * Width of the skeleton. Can be a number (px) or string value
   */
  width?: number | string;
  /**
   * Height of the skeleton. Can be a number (px) or string value
   */
  height?: number | string;
  /**
   * Border radius of the skeleton
   * - number (converted to px)
   * - string (used as-is)
   * - design token ('none' | 'S' | 'M' | 'L' | 'circle')
   * @default 'M'
   */
  borderRadius?: number | string | BorderRadiusToken;
  /**
   * The animation effect. If false, no animation is applied.
   * @default 'pulse'
   */
  animation?: AnimationType;
  /**
   * Optional className for custom styling
   */
  className?: string;
}

const pulseKeyframes = keyframes`
  0% {
    opacity: 1;
  }
  50% {
    opacity: 0.4;
  }
  100% {
    opacity: 1;
  }
`;

const waveKeyframes = keyframes`
  0% {
    transform: translateX(-100%);
  }
  50% {
    transform: translateX(100%);
  }
  100% {
    transform: translateX(100%);
  }
`;

const skeletonStyles = css`
  display: block;
  background-color: var(--ac-global-color-grey-200);
`;

const pulseAnimation = css`
  animation: ${pulseKeyframes} 2s ease-in-out 0.5s infinite;
`;

const waveAnimation = css`
  position: relative;
  overflow: hidden;
  /* Fix bug in Safari https://bugs.webkit.org/show_bug.cgi?id=68196 */
  -webkit-mask-image: -webkit-radial-gradient(white, black);

  &::after {
    animation: ${waveKeyframes} 2s linear 0.5s infinite;
    background: linear-gradient(
      90deg,
      transparent,
      var(--ac-global-color-grey-300),
      transparent
    );
    content: "";
    position: absolute;
    transform: translateX(-100%);
    bottom: 0;
    left: 0;
    right: 0;
    top: 0;
  }
`;

const getBorderRadius = (radius: SkeletonProps["borderRadius"]) => {
  if (typeof radius === "number") {
    return `${radius}px`;
  }

  if (typeof radius === "string") {
    switch (radius) {
      case "none":
        return "0";
      case "XS":
        return "var(--ac-global-rounding-xsmall)";
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

/**
 * A skeleton loading component that shows a placeholder while content is loading.
 * Supports different animations, sizes, and border radius options.
 */
export const Skeleton = forwardRef<HTMLSpanElement, SkeletonProps>(
  (
    {
      width = "100%",
      height = "1.2em",
      borderRadius = "S",
      animation = "pulse",
      className,
      ...restProps
    },
    ref
  ) => {
    const finalWidth = typeof width === "number" ? `${width}px` : width;
    const finalHeight = typeof height === "number" ? `${height}px` : height;
    const finalRadius = getBorderRadius(borderRadius);

    return (
      <span
        ref={ref}
        className={classNames(className, "ac-skeleton")}
        css={[
          skeletonStyles,
          animation === "pulse" && pulseAnimation,
          animation === "wave" && waveAnimation,
          css`
            width: ${finalWidth};
            height: ${finalHeight};
            border-radius: ${finalRadius};
          `,
        ]}
        {...restProps}
      />
    );
  }
);

Skeleton.displayName = "Skeleton";

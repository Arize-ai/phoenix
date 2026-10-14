import { css, keyframes } from "@emotion/react";
import type { HTMLAttributes, Ref } from "react";

import { classNames } from "@phoenix/utils/classNames";

import type { BorderRadiusValue } from "../types/style";

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
   * Border radius of the skeleton, from the global rounding scale
   * @default 'small'
   */
  borderRadius?: BorderRadiusValue;
  /**
   * Optional className for custom styling
   */
  className?: string;
}

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

/**
 * The skeletons' fill. Exported so a placeholder drawn by another component
 * is the same gray as a `Skeleton` beside it.
 */
export const skeletonFillCSS = css`
  background-color: var(--global-skeleton-background-color);
  opacity: var(--global-skeleton-opacity);
`;

const skeletonStyles = css`
  display: block;
  ${skeletonFillCSS}
  position: relative;
  overflow: hidden;
  /* Fix bug in Safari https://bugs.webkit.org/show_bug.cgi?id=68196 */
  -webkit-mask-image: -webkit-radial-gradient(white, black);

  &::after {
    animation: ${waveKeyframes} 2s linear 0.5s infinite;
    background: linear-gradient(
      90deg,
      transparent,
      var(--global-skeleton-wave-highlight-color),
      transparent
    );
    content: "";
    opacity: var(--global-skeleton-wave-highlight-opacity);
    position: absolute;
    transform: translateX(-100%);
    bottom: 0;
    left: 0;
    right: 0;
    top: 0;
  }

  @media (prefers-reduced-motion: reduce) {
    &::after {
      animation: none;
    }
  }
`;

/**
 * A skeleton loading component that shows a placeholder while content is loading.
 * A wave sweeps across it unless the user prefers reduced motion.
 */
export function Skeleton({
  ref,
  width = "100%",
  height = "1.2em",
  borderRadius = "small",
  className,
  ...restProps
}: SkeletonProps & { ref?: Ref<HTMLSpanElement> }) {
  const finalWidth = typeof width === "number" ? `${width}px` : width;
  const finalHeight = typeof height === "number" ? `${height}px` : height;

  return (
    <span
      ref={ref}
      className={classNames(className, "skeleton")}
      css={[
        skeletonStyles,
        css`
          width: ${finalWidth};
          height: ${finalHeight};
          border-radius: var(--global-rounding-${borderRadius});
        `,
      ]}
      {...restProps}
    />
  );
}

Skeleton.displayName = "Skeleton";

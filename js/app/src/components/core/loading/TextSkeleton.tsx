import { css } from "@emotion/react";

import type { TextSize } from "../types/sizing";
import type { AnimationType } from "./Skeleton";
import { Skeleton } from "./Skeleton";

export interface TextSkeletonProps {
  /**
   * The size of the text the skeleton stands in for. The skeleton takes that
   * size's line height, so a row of skeletons is as tall as the row of text
   * that replaces it.
   * @default 'S'
   */
  size?: TextSize;
  /**
   * Width of the skeleton. Can be a number (px) or string value.
   * @default '100%'
   */
  width?: number | string;
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

const textSkeletonCSS = css`
  display: flex;
  align-items: center;
  /* The line box and type size of the text it stands in for, so a width
     given in ch is in that text's characters; the pill sits centered in it */
  &[data-size="XS"] {
    font-size: var(--global-font-size-xs);
    height: var(--global-line-height-xs);
    --text-skeleton-height: 8px;
  }
  &[data-size="S"] {
    font-size: var(--global-font-size-s);
    height: var(--global-line-height-s);
    --text-skeleton-height: 10px;
  }
  &[data-size="M"] {
    font-size: var(--global-font-size-m);
    height: var(--global-line-height-m);
    --text-skeleton-height: 12px;
  }
  &[data-size="L"] {
    font-size: var(--global-font-size-l);
    height: var(--global-line-height-l);
    --text-skeleton-height: 14px;
  }
  &[data-size="XL"] {
    font-size: var(--global-font-size-xl);
    height: var(--global-line-height-xl);
    --text-skeleton-height: 18px;
  }
  &[data-size="XXL"] {
    font-size: var(--global-font-size-xxl);
    height: var(--global-line-height-xxl);
    --text-skeleton-height: 22px;
  }
`;

/**
 * A skeleton for one line of `Text`. It takes the line height and font size
 * of the text size it stands in for, with a pill of the text's rough cap
 * height centered in it, so the layout around it does not move when the text
 * arrives, and a width given in `ch` is measured in that text's characters.
 */
export function TextSkeleton({
  size = "S",
  width = "100%",
  animation = "pulse",
  className,
}: TextSkeletonProps) {
  return (
    <span className={className} css={textSkeletonCSS} data-size={size}>
      <Skeleton
        width={width}
        height="var(--text-skeleton-height)"
        borderRadius="var(--global-rounding-full)"
        animation={animation}
      />
    </span>
  );
}

TextSkeleton.displayName = "TextSkeleton";

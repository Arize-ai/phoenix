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
  /* The line box of the text it stands in for; the pill sits centered in it */
  &[data-size="XS"] {
    height: var(--global-line-height-xs);
    --text-skeleton-height: 8px;
  }
  &[data-size="S"] {
    height: var(--global-line-height-s);
    --text-skeleton-height: 10px;
  }
  &[data-size="M"] {
    height: var(--global-line-height-m);
    --text-skeleton-height: 12px;
  }
  &[data-size="L"] {
    height: var(--global-line-height-l);
    --text-skeleton-height: 14px;
  }
  &[data-size="XL"] {
    height: var(--global-line-height-xl);
    --text-skeleton-height: 18px;
  }
  &[data-size="XXL"] {
    height: var(--global-line-height-xxl);
    --text-skeleton-height: 22px;
  }
`;

/**
 * A skeleton for one line of `Text`. It takes the line height of the text
 * size it stands in for, with a pill of the text's rough cap height centered
 * in it, so the layout around it does not move when the text arrives.
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

import { css } from "@emotion/react";

import { classNames } from "@phoenix/utils/classNames";

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
   * The font family of the text, which a width given in `ch` is measured in.
   * @default 'default'
   */
  fontFamily?: "default" | "mono";
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
  /* The line box and type size of the text it stands in for; the pill sits
     centered in it */
  &[data-size="XS"] {
    font-size: var(--global-font-size-xs);
    height: var(--global-line-height-xs);
    --text-skeleton-pill-height: 8px;
  }
  &[data-size="S"] {
    font-size: var(--global-font-size-s);
    height: var(--global-line-height-s);
    --text-skeleton-pill-height: 10px;
  }
  &[data-size="M"] {
    font-size: var(--global-font-size-m);
    height: var(--global-line-height-m);
    --text-skeleton-pill-height: 12px;
  }
  &[data-size="L"] {
    font-size: var(--global-font-size-l);
    height: var(--global-line-height-l);
    --text-skeleton-pill-height: 14px;
  }
  &[data-size="XL"] {
    font-size: var(--global-font-size-xl);
    height: var(--global-line-height-xl);
    --text-skeleton-pill-height: 18px;
  }
  &[data-size="XXL"] {
    font-size: var(--global-font-size-xxl);
    height: var(--global-line-height-xxl);
    --text-skeleton-pill-height: 22px;
  }
`;

/**
 * A skeleton for one line of `Text`. It takes the line height, font size and
 * font family of the text it stands in for, so the layout around it does not
 * move when the text arrives and a width given in `ch` is in that text's
 * characters. A pill of the text's rough cap height sits centered in it.
 */
export function TextSkeleton({
  size = "S",
  width = "100%",
  fontFamily = "default",
  animation = "pulse",
  className,
}: TextSkeletonProps) {
  return (
    <span
      className={classNames("text-skeleton", `font-${fontFamily}`, className)}
      css={textSkeletonCSS}
      data-size={size}
    >
      <Skeleton
        width={width}
        height="var(--text-skeleton-pill-height)"
        borderRadius="var(--global-rounding-full)"
        animation={animation}
      />
    </span>
  );
}

TextSkeleton.displayName = "TextSkeleton";
